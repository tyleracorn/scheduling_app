# Production deployment

Self-host the cabin scheduling app on a NAS or home server using Docker.

> **Plan sync:** See [12-phase-9-release-gate.md](./planning/12-phase-9-release-gate.md) for the release checklist.

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

#### Build and push to GHCR (from your PC)

Run these from the **repo root** (where the `Dockerfile` lives).

1. **Log in to GHCR** (once per machine, or when your token expires):

```bash
docker login ghcr.io -u YOUR_GITHUB_USERNAME
```

Use a GitHub **Personal Access Token** with `write:packages` (and `read:packages` if the image is private). Paste the token when Docker asks for a password.

2. **Choose a tag** — pick something you will remember on the NAS:

| Tag style | Example | Good for |
|-----------|---------|----------|
| Version | `v1.2.0` | Releases you roll back to |
| Git commit | `4686e72` | “Exactly what I built from this commit” |
| Date | `2026-06-27` | Ad-hoc deploys |
| `latest` | `latest` | Convenience; NAS default if `APP_IMAGE_TAG` is unset |

3. **Build the image with that tag**:

```bash
# Replace TAG with your tag (e.g. v1.2.0)
export TAG=v1.2.0
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
APP_IMAGE_TAG=v1.2.0
```

Then pull and restart (see below).

**Quick copy-paste** (version tag):

```bash
export TAG=v1.2.0
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

## Database backup

Postgres data lives in the `postgres_data` Docker volume.

```bash
# Backup
docker compose exec db pg_dump -U cabin cabin_scheduling > backup-$(date +%Y%m%d).sql

# Restore (stop app first)
docker compose stop app
docker compose exec -T db psql -U cabin cabin_scheduling < backup-YYYYMMDD.sql
docker compose start app
```

Schedule backups with cron on the host (daily recommended).

## CSV schedule exports

The API writes period CSV files to `EXPORT_PATH` when configured:

- **Weekly** — scheduler job (Sunday midnight cabin timezone)
- **On publish** — each time a period is published

Set in `.env`:

```bash
EXPORT_PATH=/data/exports
```

Mount your NAS shared folder into the app container at that path (see `docker-compose.nas.yml`). Any signed-in member can also download a period CSV from **Periods → Download CSV**.

Example host cron to copy exports to a second location (optional):

```bash
0 3 * * 0 rsync -a /volume1/docker/cabin-scheduling/exports/ /volume1/shared/cabin-backups/csv/
```

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
