import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AuthUser } from "../lib/api";
import type { CalendarPeriod } from "../lib/calendar-types";
import { formatPeriodStatus } from "../lib/calendar-utils";
import { calendarPathForPeriod } from "../lib/period-navigation";
import {
  getPeriodAttentionMessage,
  periodShouldExpand,
  sidebarPeriods,
} from "../lib/period-attention";
import { AssignmentPanel } from "./AssignmentPanel";
import { DraftPanel } from "./DraftPanel";

type Props = {
  periods: CalendarPeriod[];
  user: AuthUser;
  isCoordinator: boolean;
  onChanged: () => void;
  refreshToken: number;
  expandPeriodId?: string | null;
};

function PeriodToolsCard({
  period,
  user,
  isCoordinator,
  onChanged,
  refreshToken,
  forceExpanded,
}: {
  period: CalendarPeriod;
  user: AuthUser;
  isCoordinator: boolean;
  onChanged: () => void;
  refreshToken: number;
  forceExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(() => periodShouldExpand(period, user));
  const attention = getPeriodAttentionMessage(period, user);
  const needsAttention = periodShouldExpand(period, user);

  useEffect(() => {
    if (forceExpanded) setExpanded(true);
  }, [forceExpanded]);

  useEffect(() => {
    if (periodShouldExpand(period, user)) setExpanded(true);
  }, [period, user, refreshToken]);

  const statusLabel = formatPeriodStatus(period.status);

  return (
    <div
      className={`rounded-lg border text-sm overflow-hidden ${
        needsAttention ? "border-amber-300 bg-amber-50/80" : "border-slate-200 bg-white"
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50/80"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{period.name}</p>
          <p className="text-xs text-slate-600 mt-0.5">{statusLabel}</p>
          {attention && !expanded && (
            <p className="text-xs font-medium text-amber-900 mt-1">{attention}</p>
          )}
        </div>
        <span className="text-slate-400 shrink-0 text-xs pt-0.5">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
          {attention && (
            <p className="text-xs text-amber-900 pt-3">{attention}</p>
          )}
          {period.start_date &&
            (period.status === "draft" ||
              period.status === "open" ||
              period.status === "assignment") && (
              <Link
                to={calendarPathForPeriod(period.start_date)}
                className="inline-block text-xs font-medium text-slate-700 underline hover:text-slate-900"
              >
                View weeks on calendar →
              </Link>
            )}
          <AssignmentPanel
            period={period}
            isCoordinator={isCoordinator}
            onChanged={onChanged}
            refreshToken={refreshToken}
            embedded
          />
          {period.status === "draft" && (
            <DraftPanel
              period={period}
              user={user}
              isCoordinator={isCoordinator}
              onChanged={onChanged}
              refreshToken={refreshToken}
              embedded
            />
          )}
        </div>
      )}

      {!expanded && (
        <div className="px-4 pb-3 border-t border-slate-100 pt-3">
          <AssignmentPanel
            period={period}
            isCoordinator={isCoordinator}
            onChanged={onChanged}
            refreshToken={refreshToken}
            embedded
            summaryOnly={period.status !== "draft"}
          />
        </div>
      )}
    </div>
  );
}

export function PeriodToolsPanel({
  periods,
  user,
  isCoordinator,
  onChanged,
  refreshToken,
  expandPeriodId,
}: Props) {
  const visible = sidebarPeriods(periods);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-800">Period activity</h2>
      <p className="text-xs text-slate-500">
        Pick weeks, assign households, and publish schedules for each season.
      </p>
      {visible.map((period) => (
        <PeriodToolsCard
          key={period.id}
          period={period}
          user={user}
          isCoordinator={isCoordinator}
          onChanged={onChanged}
          refreshToken={refreshToken}
          forceExpanded={expandPeriodId === period.id}
        />
      ))}
    </div>
  );
}
