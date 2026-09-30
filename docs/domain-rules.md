# Domain rules — what must not break

Single source of truth for cabin scheduling invariants. Prefer this over scattered planning docs when adding features or tests. Planning detail remains in [docs/planning/](./planning/README.md); coordinator how-to is in [coordinator-runbook.md](./coordinator-runbook.md).

## Roles live on households, not users

- `Household.authority`: `active` | `coordinator` | `admin`.
- User `isAdmin` is a separate flag. **System admin** = user `isAdmin` **or** household `authority === admin`.
- **Scheduling tools** (Periods page, start/resume draft, assign, publish): coordinator/admin household tier **and** `schedulingToolsEnabled` — never Worker Bee. System admins always have access.
- At most ~3 coordinator **households** (system setting). Every member of that household inherits access.
- One household per user (`HouseholdMembership.userId` is unique).
- Any member of a household may act on that household’s turn (no per-user “representative” role).

## Worker Bee

- Special household (`isWorkerBee`). At most one.
- Excluded from draft priority lists and turns.
- Cannot be a coordinator household.
- Assigned only in the **assignment** (or published reassign) phase by coordinators.

## Priority across periods

- New period default order: take the previous period’s order, rotate so the **last position becomes first**, then append any new active households at the end.
- Predecessor = period ending on or before the next period’s start (shared handoff day is OK).
- Inactive households and Worker Bee never appear in the draft priority list. Historical assignments for inactive households remain.

## Draft and timing

- Period states: `scheduled` → `open` → `draft` → `assignment` → `published` (+ `archived`).
- One household at a time. Rounds = `week_selections_per_household` (default 1).
- Pick window / warning lead come from `SystemSettings` (`pickWindowHours`, `pickWarningLeadHours`).
- Timeout → auto-skip. **Two consecutive** auto-skips → hold. Coordinator may resume, force-skip, or pick-for.
- **Voluntary skip** advances the turn and does **not** assign a week (household can still pick in a later round if N > 1).
- **Change pick** while the turn is still active; **revise** a confirmed pick while the period is still in `draft` (swap to another open week or release).
- Occupancy (green/red) is applied on confirm; revise/release should clear or move it with the week.
- **Period reset** clears turns/assignments and returns status to `open`.

## Two UI surfaces, one API

The **calendar day drawer** and the **Period activity** sidebar call the same draft / assign / swap endpoints. Behavior must match on both surfaces. See the [manual UI smoke checklist](#manual-ui-smoke-checklist) below.

## Informational-only layers

- Household notes and green/red occupancy are **display only**. They must not block picks or assignments.
- Notes/occupancy mutations are household-scoped (members edit their own household’s data).

## Swaps and post-publish

- Swap allowed in `assignment` or `published`; reason required; audit + notifications.
- Post-publish reassign requires reason + audit (`assignment_changed`).

## Calendar display vs scheduling weeks

- The month grid is always Sunday–Saturday.
- Scheduling weeks use the configured week-start day (`Wk▸` / `◂Wk` markers). The grid can look “off” relative to those markers without being wrong.

---

## Manual UI smoke checklist

Run through these on desktop and at phone width after draft/assign/swap changes. Not automated (Playwright deferred).

### During draft

- [ ] Pick a week from the **calendar day drawer** (select week → sharing indicator → confirm).
- [ ] Pick a week from **Period activity** for the same household/turn; result matches drawer behavior.
- [ ] Change pick while turn is active from both surfaces.
- [ ] Revise a confirmed pick (swap to another open week or release) from both surfaces.
- [ ] Voluntary skip advances turn; week stays unassigned.

### Assignment / publish

- [ ] Assign a remaining week from the calendar drawer (including Worker Bee if applicable).
- [ ] Swap two assigned weeks from Period activity (reason required when published).
- [ ] Publish when all weeks assigned; post-publish reassign requires a reason.

### Authority visibility

- [ ] **Active** household member: no Periods admin tools / cannot start draft or publish; can pick on own turn and use notes/occupancy.
- [ ] **Coordinator** household member (tools enabled): Periods visible; can start draft, assign, publish, resume/hold recovery.
- [ ] **Admin**: Admin page + scheduling tools as expected.

### Mobile

- [ ] Day drawer usable at phone width.
- [ ] Period activity usable below the calendar (or equivalent mobile layout).
