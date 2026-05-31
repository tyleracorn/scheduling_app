# Cabin Scheduling Application

Lightweight shared-cabin scheduling for multiple households. Self-hosted via Docker (NAS-friendly).

## Planning

See [docs/planning/README.md](./docs/planning/README.md).

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

pnpm install
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed
```

For interactive migration naming during development, use `pnpm db:migrate` instead of `db:migrate:deploy`.

```bash
# continue after seed

pnpm dev
```

- Web: http://localhost:5173  
- API: http://localhost:3000  
- Default admin: `admin@example.com` / `changeme` (from `.env`)

### Production (NAS / Docker)

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

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | API + web dev servers |
| `pnpm build` | Production build |
| `pnpm db:migrate:deploy` | Apply migrations (uses root `.env`) |
| `pnpm db:migrate` | Create/apply migrations interactively (dev) |
| `pnpm db:seed` | Seed admin + households + settings |

## Phase status

- [x] **Phase 0:** Auth, admin, health, Docker scaffold
- [x] **Phase 1:** `GET /api/v1/calendar`, month grid, period banner, week detail drawer
- [x] **Phase 2:** Household notes and green/red occupancy (CRUD, calendar display, retention filter)
- [x] **Phase 3:** Period CRUD, priority order, round-based draft (pick/skip/timeouts/hold), coordinator resume/force-skip, minute scheduler, draft UI on calendar + `/periods`

Re-seed to load demo data: `pnpm db:seed`
