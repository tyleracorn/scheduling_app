# Coordinator Runbook

Quick reference for scheduling coordinators. For click-by-click screenshots, use in-app **Help** (`/help`). Invariants and the manual UI smoke checklist: [domain-rules.md](./domain-rules.md).

## App pages (who uses what)

| Page | Audience | Purpose |
|------|----------|---------|
| **Settings** | Everyone | Account (name, password), calendar display preferences |
| **Periods** | Coordinators & admins | Period plan, generate periods, start draft, reset/delete |
| **Admin** | Admins only | Users, households, system defaults, email status, audit log |

## Period lifecycle

1. **Configure plan** — Periods → Period plan (week start, weeks per period, rounds, count). **Preview weeks** before generating.
2. **Generate periods** — Periods → Generate periods.
3. **Open** — Auto-open at `opening_at`. Households can add notes.
4. **Start draft** — Periods → Start draft when ready.
5. **Draft** — Pick from the calendar day drawer or **Period activity**. Sharing (green/red/none) + confirm. Hold after 2 consecutive auto-skips.
6. **Assignment** — Assign remaining weeks from the calendar (click unassigned days).
7. **Publish** — Period activity → Publish when all weeks assigned.

## Hold recovery

- **Resume draft** — Continue after hold (Period activity).
- **Force skip** — Skip the stuck household’s turn.
- **Pick for household** — Select a week on their behalf.

## Common actions

- **Swap** — Period activity → swap two assigned weeks (reason required when published).
- **Revise pick** — During draft, change or release a confirmed pick (drawer or Period activity).
- **Worker Bee** — Excluded from draft; assign manually in assignment phase.
- **Post-publish reassign** — Day drawer → reason required; audit + notify.
- **Reset period** — Clears turns/assignments → Open (dry-runs only).

## Tips

- Month grid is always Sunday–Saturday; scheduling weeks follow period-plan week start (`Wk▸` markers).
- Pick window / warning lead: **Admin → System**.
- Coordinator households: **Admin → Households** (max ~3); all members get Periods access.

## Related

- [Manual UI smoke checklist](./domain-rules.md#manual-ui-smoke-checklist)
- [Production deployment](./production-deployment.md)
- [Release checklist](./release-checklist.md)
