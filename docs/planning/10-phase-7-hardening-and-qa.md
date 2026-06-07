# Phase 7 — Hardening and QA

> **Plan sync:** Before starting or changing scope, read the master completion plan in Cursor (`complete_mvp_development_cycle`) and check for updates. If this file and the plan disagree, follow the plan.

**Status:** Complete (integration tests added; manual QA checklist documented)  
**Depends on:** Phase 6 complete  
**Estimated effort:** ~1 week

## Objective

Prove the scheduling engine and admin flows work reliably before NAS deployment.

## Deliverables

### Integration tests (API + test DB, CI already has Postgres)

| Scenario | Validates roadmap success criteria |
|----------|-----------------------------------|
| Draft happy path | No double-booked weeks |
| Auto-skip + hold | Two timeouts → hold → coordinator resume |
| Publish + reassign | Audit row + `assignment_changed` notification |

### Manual QA pass

Use the checklist in `.cursor/rules/project-context.mdc`:

- Admin page (households, slots, worker bee, user admin)
- Settings (period plan, preview, generate)
- Periods (start draft, reset, delete)
- Calendar on phone-sized viewport (spot-check after Phase 6)

### Cleanup (optional, low risk)

- Remove unused `PeriodStatusBanner.tsx`
- Fix duplicate `dev:api` / `dev:web` in root `package.json`
- Align plain-language status labels on `PeriodsPage`

## Exit criteria

- [x] Integration tests run in CI (`pnpm test`)
- [ ] Manual QA checklist completed with no blocking issues
- [x] No regressions on calendar-first layout or mobile nav (prior session)
- [x] Removed unused `PeriodStatusBanner.tsx`
- [x] Fixed duplicate `dev:api` / `dev:web` in root `package.json`
- [x] Plain-language status labels on `PeriodsPage`

## Out of scope

- Playwright/browser E2E (optional later)
- WCAG accessibility audit (target for beta, not blocking MVP)
