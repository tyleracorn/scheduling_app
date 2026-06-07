# Phase 8 — Documentation and ops readiness

> **Plan sync:** Before starting or changing scope, read the master completion plan in Cursor (`complete_mvp_development_cycle`) and check for updates. If this file and the plan disagree, follow the plan.

**Status:** Complete  
**Depends on:** Phase 7 complete (or in parallel with final QA fixes)  
**Estimated effort:** 2–3 days

## Objective

Bring written docs in line with the current app and prepare operators for NAS deployment.

## Deliverables

| Doc | Updates |
|-----|---------|
| `README.md` | Calendar-first UX, worker bee, swap/revise pick; migrate from repo root |
| `docs/coordinator-runbook.md` | Period activity sidebar, swap weeks, worker bee, revise pick |
| `docs/production-deployment.md` | **New:** NAS reverse proxy, env vars, health checks, backup/restore |
| `docs/planning/08-roadmap-and-mvp.md` | Mark release gate items as completed when done |
| `.cursor/rules/project-context.mdc` | Fix quality-check commands; period/week vocabulary |

## Production deployment guide (outline)

- Copy `.env.example` → `.env`; set `SESSION_SECRET`, `APP_URL`, `SMTP_*`
- `docker compose up -d --build`
- Reverse proxy to port 3000
- Postgres backup: `pg_dump` from `postgres_data` volume
- Health: `GET /health` and `GET /health/ready`

## Exit criteria

- [x] New coordinator can follow runbook without asking how to pick weeks
- [x] Admin can deploy from README + production-deployment guide alone
- [x] Cursor rules match actual repo conventions

## Out of scope

- SPF/DKIM DNS setup (document steps; execution is ops task in Phase 9)
