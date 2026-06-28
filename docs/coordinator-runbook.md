# Coordinator Runbook

Quick reference for scheduling coordinators.

## App pages (who uses what)

| Page | Audience | Purpose |
|------|----------|---------|
| **Settings** | Everyone | Your account (name, password), calendar display preferences |
| **Periods** | Coordinators & admins | Period plan, generate periods, start draft, reset/delete |
| **Admin** | Admins only | Users, households, system defaults, email status, audit log |

## Period lifecycle

1. **Configure plan** — Periods → Period plan panel (week start, weeks per period, rounds, count). Use **Preview weeks** before generating.
2. **Generate periods** — Periods → Generate periods.
3. **Open** — Periods auto-open at `opening_at` (scheduler). Households can add notes.
4. **Start draft** — Periods → Start draft when ready.
5. **Draft** — Households pick on the calendar (click an open week) or in **Period activity** beside the calendar. Choose sharing (green/red/none), then **Confirm week** in one step. On hold after 2 consecutive auto-skips.
6. **Assignment** — After draft, assign remaining weeks on the calendar (click unassigned days).
7. **Publish** — Period activity panel → Publish when all weeks assigned.

## Calendar layout

- **Calendar grid** is the main view; month navigation stays at the top.
- **Period activity** sidebar holds pick/assign/swap controls for each season (alternate path during draft).
- **Click a day** to open the drawer for draft picks, notes, sharing (green/red), and coordinator assign/reassign.
- **Sticky alerts** at the top link to the relevant period panel when action is needed.

## Hold (2 consecutive auto-skips)

- Draft pauses; no next turn activates.
- **Resume draft** — Resets hold and continues (Period activity panel).
- **Force skip** — Skip the stuck household’s turn.
- **Pick for household** — Coordinator selects a week on their behalf.

## Swap weeks (coordinator)

- In Period activity → expand assignment section → **Swap two assigned weeks**.
- Required reason when swapping published weeks.

## Revise pick (during draft)

- Households can change a confirmed pick to another open week, or release it, while the draft is still running — in Period activity or via the day drawer.

## Worker Bee

- Special household for group project weeks; excluded from draft turns.
- Coordinator assigns Worker Bee weeks manually during assignment phase.

## Post-publish changes

- Click any assigned week on the calendar → Reassign with a **required reason**.
- Affected households are notified; change appears in Admin → Assignment audit log.

## Reset period (testing)

- **Periods → Reset period** on draft, assignment, or published periods.
- Clears all assignments and draft turns; status returns to **Open** so you can start draft again.
- Use for dry-runs and testing — not for routine production changes.

## Tips

- Navigate to the period month via Periods → Open on calendar.
- The month grid is always **Sunday–Saturday**; scheduling weeks use the **week start** day from the period plan (`Wk▸` / `◂Wk` markers on the calendar).
- Pick window and warning lead are in **Admin → System** (admin edit).
- Coordinator households are set in **Admin → Households** (max 3 owning households); all members of those households get Periods access.
- Email notifications go out for: your turn, **deadline warning**, hold, assignment phase, publish, assignment changes.

## Production deployment

See [production-deployment.md](./production-deployment.md) for NAS/Docker setup, backups, and email.
