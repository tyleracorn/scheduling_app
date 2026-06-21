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

- [`docker-compose.nas.yml`](../docker-compose.nas.yml) — `app` pulls `ghcr.io/tyleracorn/scheduling-app`, no `build`
- [`.env.nas.example`](../.env.nas.example) — production `.env` template

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
    image: ghcr.io/YOUR_ORG/scheduling-app:latest
```

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Reverse proxy

Point HTTPS at **port 3000** on the host running the `app` container. The same process serves the React UI and API. Set `APP_URL` to the public HTTPS URL users open in the browser.

## Post-deploy setup

1. Log in with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`; change password under **Settings**.
2. **Admin → Households** — sync slot count, name/color households, mark up to **three owning households** as **Coordinator** (any active member of those households can run periods and drafts).
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

Migrations and seed run automatically via `docker/entrypoint.sh` on container start.

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

## Email deliverability

For turn warnings and draft notifications to reach inboxes:

1. Set `SMTP_*` in `.env`
2. Add SPF record for your sending domain pointing at your mail server
3. Enable DKIM on the mail server if available
4. Admin → **Email** → **Send test email to me** (or send a test invite from Admin → People)

## UI overview

- **Settings** — personal account and calendar display preferences (all users).
- **Periods** — period plan and scheduling operations (coordinators and admins).
- **Admin** — users, households (coordinator flag), system defaults, email status (admins only).

SMTP credentials are **not** stored in the database. Configure `SMTP_*` in `.env` or Docker Compose, restart the API container, then verify in Admin → Email.

## Security notes

- Session cookies use `SameSite=Lax` — suitable for same-origin deployment behind one HTTPS hostname
- Do not expose port 3000 directly to the internet without the reverse proxy handling TLS
- Rotate `SESSION_SECRET` only with a planned logout (invalidates all sessions)

## Coordinator dry-run

Before the first real scheduling season, run through [coordinator-runbook.md](./coordinator-runbook.md) on production with test accounts. Use **Periods → Reset period** between trials.
