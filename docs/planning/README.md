# Cabin Scheduling — Planning Documents

Product and technical planning for a lightweight shared-cabin scheduling application.

## Reading order

1. [01-pick-model-decision.md](./01-pick-model-decision.md) — Draft round model (resolved open question)
2. [02-refined-requirements.md](./02-refined-requirements.md) — Full requirements baseline
3. [03-user-stories.md](./03-user-stories.md) — Stories by epic with MVP tags
4. [04-system-workflows.md](./04-system-workflows.md) — Lifecycles, state machines, notifications
5. [05-database-schema.md](./05-database-schema.md) — PostgreSQL tables and constraints
6. [06-api-design.md](./06-api-design.md) — REST API surface
7. [07-technology-stack.md](./07-technology-stack.md) — Stack recommendation
8. [08-roadmap-and-mvp.md](./08-roadmap-and-mvp.md) — Original phased delivery and MVP definition

### Completion phases (MVP + polish)

9. [09-phase-6-mvp-story-gaps.md](./09-phase-6-mvp-story-gaps.md) — Turn warnings, audit UI, user admin, period preview
10. [10-phase-7-hardening-and-qa.md](./10-phase-7-hardening-and-qa.md) — Integration tests and manual QA
11. [11-phase-8-docs-and-ops.md](./11-phase-8-docs-and-ops.md) — Documentation and production guide
12. [12-phase-9-release-gate.md](./12-phase-9-release-gate.md) — NAS deploy and coordinator dry-run

## Product principles

- Calendar is the primary screen.
- Scheduling coordinates visibility; negotiations stay outside the app.
- Notes and green/red occupancy are **informational only**.
