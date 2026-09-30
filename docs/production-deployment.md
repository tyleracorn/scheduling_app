# Production deployment

Self-host the cabin scheduling app on a NAS or home server using Docker.

> Release gate and dry-run: [release-checklist.md](./release-checklist.md).

## Prerequisites

- Docker and Docker Compose
- Reverse proxy (Synology, nginx, Caddy, etc.) with HTTPS
- Optional: SMTP server for email notifications

## Setup

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Required | Notes |
|----------|----------|-------|
| `SESSION_SECRET` | Yes | `openssl rand -base64 32` |
| `APP_URL` | Yes | Public URL users open in browser (e.g. `https://cabin.example.com`) |
| `SEED_ADMIN_EMAIL` | Yes | First admin login |
| `SEED_ADMIN_PASSWORD` | Yes | Change after first login |
| `SMTP_HOST` | No | Leave empty to log emails only |
| `SMTP_PORT` | No | Default 587 |
| `SMTP_USER` / `SMTP_PASS` | No | If your SMTP server requires auth |
| `SMTP_FROM` | No | From address for notifications |

## Deploy on a NAS (Synology and similar)

The repo includes a [`Dockerfile`](../Dockerfile) and [`docker-compose.yml`](../docker-compose.yml). You do **not** need Node installed on the NAS if you use Docker.

### Build on the NAS (recommended first)

Best when the NAS has Docker Compose and enough RAM (~2 GB free during build).

1. Install **Container Manager** (Synology) or Docker Compose on your NAS.
2. Copy the project onto the NAS (`git clone` or upload the folder).
3. Create `.env` in the project root (see table above).
4. From the project directory:

```bash
docker compose up -d --build
```

First build may take several minutes. Updates: pull/copy new code, then `docker compose up -d --build` again.

**Synology Container Manager:** Create → Project → upload or paste `docker-compose.yml`, set the env file path to your `.env`, deploy.

### Pre-built image from GHCR (TrueNAS / Komodo)

Build and push from your PC, then pull on the NAS. Example files:

- [`docker-compose.nas.yml`](../docker-compose.nas.yml) — `app` pulls `ghcr.io/tyleracorn/scheduling_app`, no `build`
- [`.env.nas.example`](../.env.nas.example) — production `.env` template

#### Automated publish (GitHub Actions)

On every **git tag** matching `v*` (for example `v1.1.2`), [`.github/workflows/publish-image.yml`](../.github/workflows/publish-image.yml) builds the image and pushes to GHCR:

- `ghcr.io/tyleracorn/scheduling_app:<tag>`
- `ghcr.io/tyleracorn/scheduling_app:latest`

```bash
# After bumping package.json version and committing:
git tag v1.1.2
git push origin v1.1.2
```

You can also run **Actions → Publish image → Run workflow** and enter a tag (manual dispatch). Uses `GITHUB_TOKEN` — no Personal Access Token required for same-repo packages.

**If the workflow fails with `permission_denied: write_package`:** the package was likely first created by a local `docker push` (PAT). Grant Actions write access once:

1. Open [github.com/tyleracorn/scheduling_app/pkgs/container/scheduling_app](https://github.com/tyleracorn/scheduling_app/pkgs/container/scheduling_app) (or **Packages** on your profile → `scheduling_app`).
2. **Package settings** (right sidebar).
3. Under **Manage Actions access** → **Add repository** → select `tyleracorn/scheduling_app` → role **Write**.
4. Re-run the failed workflow (or **Actions → Publish image → Run workflow** with tag `v1.1.2`).

Then set `APP_IMAGE_TAG` on the NAS and pull (below).

#### Build and push to GHCR (from your PC)

Use this when you need a one-off image without tagging. For normal releases, prefer the Actions flow above.

Run these from the **repo root** (where the `Dockerfile` lives).

1. **Log in to GHCR** (once per machine, or when your token expires):

```bash
docker login ghcr.io -u YOUR_GITHUB_USERNAME
```

Use a GitHub **Personal Access Token** with `write:packages` (and `read:packages` if the image is private). Paste the token when Docker asks for a password.

2. **Choose a tag** — pick something you will remember on the NAS:

| Tag style | Example | Good for |
|-----------|---------|----------|
| Version | `v1.1.2` | Releases you roll back to |
| Git commit | `4686e72` | “Exactly what I built from this commit” |
| Date | `2026-06-27` | Ad-hoc deploys |
| `latest` | `latest` | Convenience; NAS default if `APP_IMAGE_TAG` is unset |

3. **Build the image with that tag**:

```bash
# Replace TAG with your tag (e.g. v1.1.2)
export TAG=v1.1.2
docker build -t ghcr.io/tyleracorn/scheduling_app:$TAG .
```

Optional — also point `latest` at this build:

```bash
docker tag ghcr.io/tyleracorn/scheduling_app:$TAG ghcr.io/tyleracorn/scheduling_app:latest
```

4. **Push the tag(s) to GHCR**:

```bash
docker push ghcr.io/tyleracorn/scheduling_app:$TAG
# if you tagged latest:
docker push ghcr.io/tyleracorn/scheduling_app:latest
```

5. **On the NAS**, set the same tag in `.env` so compose pulls the image you just pushed:

```bash
APP_IMAGE_TAG=v1.1.2
```

Then pull and restart (see below).

**Quick copy-paste** (version tag):

```bash
export TAG=v1.1.2
docker build -t ghcr.io/tyleracorn/scheduling_app:$TAG .
docker push ghcr.io/tyleracorn/scheduling_app:$TAG
```

If the package is new, create it on first push under GitHub → **Packages**. For a private repo, ensure the NAS login can read the package.

#### Pull and run on the NAS

On the NAS (only these files + `.env` are required; no full repo clone):

```bash
cp .env.nas.example .env
# edit .env — SESSION_SECRET, APP_URL, passwords, admin email

docker login ghcr.io -u YOUR_GITHUB_USER
docker compose -f docker-compose.nas.yml pull
docker compose -f docker-compose.nas.yml up -d
```

Updates after a new push from your PC:

```bash
docker compose -f docker-compose.nas.yml pull app
docker compose -f docker-compose.nas.yml up -d app
```

Fresh database (wipes all data):

```bash
docker compose -f docker-compose.nas.yml down -v
docker compose -f docker-compose.nas.yml up -d
```

### Pre-built image (compose override)

If you prefer keeping the repo `docker-compose.yml` with `build: .`, use an override:

```yaml
# docker-compose.prod.yml
services:
  app:
    image: ghcr.io/YOUR_ORG/scheduling_app:latest
```

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Reverse proxy

Point HTTPS at **port 3000** on the host running the `app` container. The same process serves the React UI and API. Set `APP_URL` to the public HTTPS URL users open in the browser.

## Post-deploy setup

1. Log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (set on first deploy only); change password under **Settings**.
2. **Admin → Households** — sync slot count, name/color households, set **authority** (coordinator/admin) on up to the configured cap. Members of coordinator households enable scheduling tools under **Settings**.
3. **Admin → People** — invite users into households.
4. **Admin → Email** — send a test email after configuring `SMTP_*` in `.env`.
5. Run the [coordinator dry-run](#coordinator-dry-run) before the first real season.

Coordinator powers are tied to **households**, not individual logins. Inviting a new person to a coordinator household gives them period/draft access automatically.

## Start

```bash
docker compose up -d --build
```

The app listens on **port 3000** (API + static web UI). Point your reverse proxy at that port.

Health checks:

- `GET /health` — process up
- `GET /health/ready` — database reachable

Migrations run automatically on every container start via `docker/entrypoint.sh`. A **bootstrap seed** also runs: it creates the admin account, default households, and system settings if missing. It does **not**:

- reset the admin password after you change it in Settings
- recreate demo calendar periods (unless you set `SEED_DEMO=true`, which you should not in production)
- change which household is coordinator after you configure one

| Variable | When to use |
|----------|-------------|
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | First deploy — creates admin if missing |
| `FORCE_SEED_PASSWORD=true` | Recovery only — resets admin password from env on next start |
| `SEED_DEMO=true` | **Dev only** — sample calendar periods and notes |

Local development: `pnpm db:seed` (bootstrap) or `pnpm db:seed:demo` (bootstrap + demo data).

## Schedule backups (CSV + Postgres)

Two artifacts, different jobs:

| Artifact | Job | When TrueNAS is dead |
|----------|-----|----------------------|
| `latest_<PeriodName>.csv` | Human-readable schedule | Open in Sheets/Excel and run the cabin by hand |
| `cabin_latest.sql` | Full DB dump | Restore into a rebuilt Postgres to bring the app back |

CSV alone cannot rebuild the database (there is no import). Keep a copy of `.env` (secrets) in a password manager or a private Drive note — dumps without env values make redeploy painful.

### 1. On-NAS folder layout

Create a dataset (example): `tank/apps/cabin-scheduling/backups`.

In `.env` (see `.env.nas.example`):

```bash
EXPORTS_HOST_PATH=/mnt/tank/apps/cabin-scheduling/backups
EXPORT_PATH=/data/exports/csv
```

Compose mounts `EXPORTS_HOST_PATH` → `/data/exports` on the app container. Layout on disk:

```text
backups/
  csv/          # app auto-exports (EXPORT_PATH)
  db/           # scripts/backup-db.sh dumps
```

Redeploy after changing env:

```bash
docker compose -f docker-compose.nas.yml up -d app
```

### 2. CSV auto-exports (app)

When `EXPORT_PATH` is set, the API writes:

- **Weekly** — Sunday after 02:00 **UTC**, for periods in open / draft / assignment / published
- **On publish** and **on swap** (after publish)
- Always also overwrites `latest_<PeriodName>.csv` (use this file first in a disaster)
- Dated trail files (`weekly_…`, `published_…`, `swap_…`) are pruned after **56 days**; `latest_*` is kept

Any signed-in member can still download a period CSV from **Periods → Download CSV**.

### 3. Daily Postgres dump (host cron)

From the compose project directory on the NAS:

```bash
chmod +x scripts/backup-db.sh   # once
BACKUP_DIR=/mnt/tank/apps/cabin-scheduling/backups \
  COMPOSE_FILE=docker-compose.nas.yml \
  ./scripts/backup-db.sh
```

Writes `db/cabin_YYYY-MM-DD.sql` and overwrites `db/cabin_latest.sql`. Keeps dated dumps for **14 days**.

Schedule daily with a TrueNAS Cron Job / Init script (example: 02:00 local), after containers are up. Run once manually and confirm files appear under `backups/db/`.

Manual one-off (equivalent):

```bash
docker compose -f docker-compose.nas.yml exec -T db \
  pg_dump -U cabin cabin_scheduling > /mnt/tank/apps/cabin-scheduling/backups/db/cabin_manual.sql
```

### 4. Off-box: TrueNAS Cloud Sync → Google Drive

If backups only live on TrueNAS, they die with TrueNAS. Push the whole `backups` dataset off-box:

1. TrueNAS → Credentials → Cloud Credentials → add **Google Drive** (OAuth).
2. Data Protection → Cloud Sync Tasks → **Push** the backups dataset to a Drive folder (e.g. `CabinSchedulingBackups`).
3. Schedule daily **after** the dump cron (e.g. dump at 02:00, sync at 03:00).
4. Confirm once from a phone or laptop: open Drive, download `csv/latest_*.csv` and `db/cabin_latest.sql`.

Occasional Google OAuth re-auth may be needed if Cloud Sync starts failing; that is normal.

### 5. Disaster runbook

**While the NAS is down (interim schedule)**

1. From Google Drive, download `csv/latest_<PeriodName>.csv` for the active period.
2. Use the Assignments, Notes, Sharing, and Swap history sections as the interim cabin schedule.

**Rebuild after TrueNAS is back**

1. Restore the compose project from git and restore `.env` (from your password manager / private note).
2. Create the backups dataset again if needed; set `EXPORTS_HOST_PATH` / `EXPORT_PATH`.
3. Start the stack (`docker compose -f docker-compose.nas.yml up -d`).
4. Restore the database (stop the app first):

```bash
docker compose -f docker-compose.nas.yml stop app
docker compose -f docker-compose.nas.yml exec -T db \
  psql -U cabin cabin_scheduling < /mnt/tank/apps/cabin-scheduling/backups/db/cabin_latest.sql
docker compose -f docker-compose.nas.yml start app
```

If the dump only exists in Google Drive, download `cabin_latest.sql` to the NAS first, then run the restore.
5. Re-check the dump cron and Cloud Sync task are still scheduled.
6. Confirm a fresh CSV appears under `backups/csv/` after the next weekly export (or publish a test period in a non-prod stack).

## Email deliverability

For turn warnings and draft notifications to reach inboxes:

1. Set `SMTP_*` in `.env`
2. Add SPF record for your sending domain pointing at your mail server
3. Enable DKIM on the mail server if available
4. Admin → **Email** → **Send test email to me** (or send a test invite from Admin → People)

## UI overview

- **Settings** — personal account, scheduling-tools toggle (coordinator households), and calendar display preferences (all users).
- **Periods** — period plan, CSV download, and scheduling operations (members with scheduling tools enabled, and admins).
- **Admin** — users, households (authority tier), note categories, system defaults, email status (admins only).

SMTP credentials are **not** stored in the database. Configure `SMTP_*` in `.env` or Docker Compose, restart the API container, then verify in Admin → Email.

## Security notes

- Session cookies use `SameSite=Lax` — suitable for same-origin deployment behind one HTTPS hostname
- Do not expose port 3000 directly to the internet without the reverse proxy handling TLS
- Rotate `SESSION_SECRET` only with a planned logout (invalidates all sessions)

## Coordinator dry-run

Before the first real scheduling season, run through [coordinator-runbook.md](./coordinator-runbook.md) on production with test accounts. Use **Periods → Reset period** between trials.
