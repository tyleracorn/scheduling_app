import { Link } from "react-router-dom";
import type { CalendarPeriod } from "../lib/calendar-types";
import { formatPeriodStatus } from "../lib/calendar-utils";
import { calendarPathForPeriod } from "../lib/period-navigation";

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
          {p.status === "assignment" && (
            <span className="block mt-1 text-amber-800">
              Assignment phase — click unassigned weeks on the calendar to assign, then publish.
            </span>
          )}
          {p.status === "draft" && p.draft_summary?.active_turn && (
            <span className="block mt-1 text-amber-800">
              {p.draft_summary.on_hold
                ? "Draft on hold — coordinator action needed"
                : `Waiting for ${p.draft_summary.active_turn.household_name} to pick`}
            </span>
          )}
          {p.status === "draft" && (
            <span className="block mt-2 text-amber-900">
              Pick or skip weeks in the <strong>Draft</strong> panel below (not by clicking days).
            </span>
          )}
          {p.start_date && (p.status === "draft" || p.status === "open" || p.status === "assignment") && (
            <Link
              to={calendarPathForPeriod(p.start_date)}
              className="inline-block mt-2 text-sm font-medium text-amber-900 underline hover:text-amber-950"
            >
              View weeks on calendar →
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
