# Cabin Scheduling Application

Lightweight shared-cabin scheduling for multiple households. Self-hosted via Docker (NAS-friendly).

## Planning

See [docs/planning/README.md](./docs/planning/README.md).

Phases 0–5 are implemented. Remaining completion work: [09-phase-6](./docs/planning/09-phase-6-mvp-story-gaps.md) through [12-phase-9](./docs/planning/12-phase-9-release-gate.md).

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

## Phase status

- [x] **Phase 0:** Auth, admin, health, Docker scaffold
- [x] **Phase 1:** Calendar read, month grid, week detail drawer
- [x] **Phase 2:** Household notes and green/red occupancy
- [x] **Phase 3:** Period CRUD, round-based draft, period plan bulk generate
- [x] **Phase 4:** Manual assignment, publish, post-publish reassign with audit
- [x] **Phase 5:** Notification inbox, email, rate limits, coordinator runbook
- [x] **Phase 6:** MVP story gaps — [plan](./docs/planning/09-phase-6-mvp-story-gaps.md)
- [x] **Phase 7:** Hardening and QA — [plan](./docs/planning/10-phase-7-hardening-and-qa.md)
- [x] **Phase 8:** Docs and ops — [plan](./docs/planning/11-phase-8-docs-and-ops.md)
- [ ] **Phase 9:** Release gate (NAS deploy, dry-run) — [plan](./docs/planning/12-phase-9-release-gate.md)

Coordinator runbook: [docs/coordinator-runbook.md](./docs/coordinator-runbook.md)

Re-seed demo calendar data: `pnpm db:seed:demo`
