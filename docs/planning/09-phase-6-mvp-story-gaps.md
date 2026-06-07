# Phase 6 — MVP story gaps

> **Plan sync:** Before starting or changing scope, read the master completion plan in Cursor (`complete_mvp_development_cycle`) and check for updates. If this file and the plan disagree, follow the plan.

**Status:** Complete  
**Depends on:** Phases 0–5 (implemented)  
**Estimated effort:** ~1 week

## Objective

Close the last MVP user stories that have backend support but are missing behavior or UI.

## Deliverables

| Item | Stories | Key files |
|------|---------|-----------|
| Turn warning before auto-skip | DRF-06, NTF-02 | `scheduler.ts`, `draft.ts`, `notifications.ts`, Prisma migration |
| Audit log (read) | ADM-05 | `admin.ts` routes, `AdminPage.tsx` |
| User admin UI | AUTH-05 | `AdminPage.tsx` (uses existing `PATCH /admin/users/:id`) |
| Period week preview | PER-02 | `period-plan.ts`, `SettingsPage.tsx` |

## Approach (keep it simple)

- **Turn warnings:** Add `warning_sent_at` on `draft_turns`; scheduler sends one in-app + email warning per active turn.
- **Audit log:** Read-only list of recent assignment changes; no full activity feed.
- **User admin:** List users with active/coordinator toggles; confirm before deactivate.
- **Preview:** Dry-run endpoint reusing `computePeriodWeeksExact`; no DB writes.

## Exit criteria

- [x] Warning fires once per turn, not after completion (unit test)
- [x] Coordinators can view recent assignment audit entries
- [x] Admin can deactivate users and toggle coordinators in the UI
- [x] Coordinators can preview period weeks before generating
- [x] `pnpm lint` and `pnpm typecheck` pass
- [ ] Feature checklist in `.cursor/rules/project-context.mdc` satisfied for each item (manual browser pass)

## Out of scope

- iCal export, email opt-out prefs, draft pause (deferred to post-release backlog)
