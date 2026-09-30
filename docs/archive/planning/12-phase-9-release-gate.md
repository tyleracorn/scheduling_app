> **Historical:** Superseded by [docs/release-checklist.md](../../release-checklist.md). Kept for design history only.

# Phase 9 — Release gate and first season

**Status:** Superseded — use the living [release-checklist.md](../../release-checklist.md)  
**Depends on:** Phases 6–8 complete

## Objective

Deploy to production, validate with coordinators, then run the first real scheduling period.

## MVP release gate checklist

From [08-roadmap-and-mvp.md](./08-roadmap-and-mvp.md) §1.5 — living copy: [release-checklist.md](../../release-checklist.md).

- [ ] **Production dry-run** — Full period on NAS with real household accounts; use Periods → Reset between trials
- [ ] **Email deliverability** — SMTP configured; SPF/DKIM on sending domain verified
- [ ] **Backup/restore** — Postgres backup taken and restore tested
- [ ] **Runbook sign-off** — Coordinators confirm hold, resume, assign, publish, swap flows

## Suggested dry-run script

1. Admin: sync households, invite test users per household
2. Coordinator: configure period plan → **Preview weeks** → generate periods
3. Wait for / force period open → households add notes
4. Start draft → each household picks (include timeout/hold test in a reset trial)
5. Assign remaining weeks → publish
6. Post-publish reassign one week with reason → verify audit log + notification
7. Reset period; repeat if issues found

## Exit criteria (definition of done)

- [ ] Release gate checklist fully checked
- [ ] One successful dry-run with coordinators
- [ ] Group ready for first real scheduling season

## After release

Track feedback from the first season. See [backlog.md](../../backlog.md).
