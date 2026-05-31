import type { CalendarPeriod } from "../lib/calendar-types";
import { formatPeriodStatus } from "../lib/calendar-utils";

export function PeriodStatusBanner({ periods }: { periods: CalendarPeriod[] }) {
  const active = periods.filter((p) => p.status !== "published" && p.status !== "archived");
  if (active.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {active.map((p) => (
        <div
          key={p.id}
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <span className="font-medium">{p.name}</span>
          <span className="mx-2 text-amber-700">·</span>
          <span>{formatPeriodStatus(p.status)}</span>
          {p.status === "draft" && p.draft_summary?.active_turn && (
            <span className="block mt-1 text-amber-800">
              {p.draft_summary.on_hold
                ? "Draft on hold — coordinator action needed"
                : `Waiting for ${p.draft_summary.active_turn.household_name} to pick`}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
