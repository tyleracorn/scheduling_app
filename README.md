# Cabin Scheduling Application

Lightweight shared-cabin scheduling for multiple households. Self-hosted via Docker (NAS-friendly).

## Documentation

See **[docs/README.md](./docs/README.md)** for the docs hub (domain rules, coordinator runbook, deployment, release checklist, backlog).

In-app Help: `/help` after signing in.

## Quick start (development)

### Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (for Postgres)

### Setup

```bash
cp .env.example .env
# Edit SESSION_SECRET in .env (openssl rand -base64 32)

docker compose -f docker-compose.dev.yml up -d

Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
pnpm install
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed
```

For interactive migration naming during development, use `pnpm db:migrate` instead of `db:migrate:deploy`.

Always run database commands from the **repo root** so `DATABASE_URL` from `.env` is loaded.

```bash
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3000
- Default admin: `admin@example.com` / `changeme` (from `.env`)

### Production (NAS / Docker)

See [docs/production-deployment.md](./docs/production-deployment.md).

```bash
cp .env.example .env
# Set SESSION_SECRET, APP_URL (public URL), SMTP_* optional

docker compose up -d --build
```

Point your NAS reverse proxy at port **3000**. The app container serves the API and static UI.

Health: `GET /health` and `GET /health/ready`

## Repository layout

```
apps/api/     Fastify + Prisma (PostgreSQL)
apps/web/     React + Vite
docker/       Entrypoint (migrate, seed, start)
```

## UI overview

- **Calendar-first** home page: month grid with period tools in a side panel (desktop) or below (mobile)
- **Day drawer** for notes, sharing indicators, and coordinator assign/reassign
- **Worker Bee** household for group weeks (admin-managed)
- **Swap weeks** and **revise pick** for coordinators and households during draft

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | API + web dev servers |
| `pnpm build` | Production build |
| `pnpm test` | API unit + integration tests |
| `pnpm db:migrate:deploy` | Apply migrations (uses root `.env`) |
| `pnpm db:migrate` | Create/apply migrations interactively (dev) |
| `pnpm db:seed` | Bootstrap: admin, households, settings |
| `pnpm db:seed:demo` | Bootstrap + demo calendar (or set `SEED_DEMO=true`) |

## Status

Phases 0–8 are complete. Remaining: [release checklist](./docs/release-checklist.md) (production dry-run / first season).

Historical planning docs: [docs/archive/planning/](./docs/archive/planning/).

Re-seed demo calendar data: `pnpm db:seed:demo`
