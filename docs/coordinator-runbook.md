# Coordinator Runbook

Quick reference for scheduling coordinators.

## Period lifecycle

1. **Configure plan** — Settings → Period plan (week start, weeks per period, open lead, rounds, count).
2. **Generate periods** — Settings → Generate periods (or Periods page link).
3. **Open** — Periods auto-open at `opening_at` (scheduler). Households can add notes.
4. **Start draft** — Periods → Start draft when ready.
5. **Draft** — Households pick/skip in the calendar Draft panel. On hold after 2 consecutive auto-skips.
6. **Assignment** — After draft, assign remaining weeks on the calendar (click unassigned days).
7. **Publish** — Assignment panel → Publish when all weeks assigned.

## Hold (2 consecutive auto-skips)

- Draft pauses; no next turn activates.
- **Resume draft** — Resets hold and continues (Draft panel).
- **Force skip** — Skip the stuck household’s turn.
- **Pick for household** — Coordinator selects a week on their behalf.

## Post-publish changes

- Click any assigned week on the calendar → Reassign with a **required reason**.
- Affected households are notified; change is audit-logged.

## Reset period (testing)

- **Periods → Reset period** on draft, assignment, or published periods.
- Clears all assignments and draft turns; status returns to **Open** so you can start draft again.
- Use for dry-runs and testing — not for routine production changes.

## Tips

- Navigate to the period month via Periods → Open on calendar.
- The month grid is always **Sunday–Saturday**; scheduling weeks use the **week start** day from Settings / period plan (`Wk▸` / `◂Wk` markers on the calendar).
- Pick window and warning lead are in Settings → System settings (admin edit).
- Email notifications go out for: your turn, hold, assignment phase, publish, assignment changes.
