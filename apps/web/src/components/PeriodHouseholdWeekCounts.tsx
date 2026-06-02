import type { PeriodAssignmentSummary } from "../lib/api";

type Props = {
  summary: PeriodAssignmentSummary | null;
  compact?: boolean;
};

export function PeriodHouseholdWeekCounts({ summary, compact }: Props) {
  if (!summary) return null;

  const maxWeeks = Math.max(1, ...summary.households.map((h) => h.weeks_assigned));
  const evenHint =
    summary.even_split_hint != null
      ? summary.even_split_hint.toFixed(1).replace(/\.0$/, "")
      : null;

  return (
    <div
      className={`rounded-md border border-slate-200 bg-white/80 ${
        compact ? "p-2 text-xs" : "p-3 text-sm"
      }`}
    >
      <p className="font-medium text-slate-800 mb-1">Weeks per household</p>
      <p className="text-slate-500 text-xs mb-2">
        {summary.assigned_weeks} of {summary.total_weeks} weeks assigned
        {evenHint != null && (
          <span className="block mt-0.5">
            ~{evenHint} weeks each if split evenly among owning households
            {summary.draft_picks_per_household > 0 && (
              <> · draft allows {summary.draft_picks_per_household} pick(s) each</>
            )}
          </span>
        )}
      </p>
      <ul className="space-y-1.5">
        {summary.households.map((h) => (
          <li key={h.household_id} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: h.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-slate-700">
              {h.household_name}
              {h.is_worker_bee && (
                <span className="ml-1 text-slate-400 font-normal">(group)</span>
              )}
            </span>
            <span className="font-medium tabular-nums text-slate-800">{h.weeks_assigned}</span>
            <span
              className="h-1.5 rounded-full bg-slate-200 overflow-hidden w-12 shrink-0"
              aria-hidden
            >
              <span
                className="block h-full rounded-full bg-slate-500"
                style={{ width: `${(h.weeks_assigned / maxWeeks) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
