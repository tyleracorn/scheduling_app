import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AuthUser } from "../lib/api";
import type { CalendarPeriod } from "../lib/calendar-types";
import { formatPeriodStatus } from "../lib/calendar-utils";
import type { CalendarViewMode } from "../lib/calendar-view-mode";
import { coordinatePathForPeriod } from "../lib/period-navigation";
import {
  getPeriodAttentionMessage,
  periodShouldExpand,
  sidebarPeriods,
} from "../lib/period-attention";
import type { OccupancyPick } from "../lib/occupancy-choice";
import { AssignmentPanel } from "./AssignmentPanel";
import { DraftPanel } from "./DraftPanel";

type Props = {
  periods: CalendarPeriod[];
  user: AuthUser;
  viewMode: CalendarViewMode;
  onChanged: () => void;
  onDraftAction?: () => void;
  refreshToken: number;
  expandPeriodId?: string | null;
  pickOccupancy: OccupancyPick;
  onPickOccupancyChange: (value: OccupancyPick) => void;
  coordOccupancy: OccupancyPick;
  onCoordOccupancyChange: (value: OccupancyPick) => void;
  preferredWeekId?: string | null;
  preferredPeriodId?: string | null;
};

function PeriodToolsCard({
  period,
  user,
  viewMode,
  onChanged,
  onDraftAction,
  refreshToken,
  forceExpanded,
  pickOccupancy,
  onPickOccupancyChange,
  coordOccupancy,
  onCoordOccupancyChange,
  preferredWeekId = null,
  preferredPeriodId = null,
}: {
  period: CalendarPeriod;
  user: AuthUser;
  viewMode: CalendarViewMode;
  onChanged: () => void;
  onDraftAction?: () => void;
  refreshToken: number;
  forceExpanded?: boolean;
  pickOccupancy: OccupancyPick;
  onPickOccupancyChange: (value: OccupancyPick) => void;
  coordOccupancy: OccupancyPick;
  onCoordOccupancyChange: (value: OccupancyPick) => void;
  preferredWeekId?: string | null;
  preferredPeriodId?: string | null;
}) {
  const [expanded, setExpanded] = useState(() => periodShouldExpand(period, user, viewMode));
  const attention = getPeriodAttentionMessage(period, user, viewMode);
  const needsAttention = periodShouldExpand(period, user, viewMode);
  const syncedWeekId =
    preferredWeekId && preferredPeriodId === period.id ? preferredWeekId : null;

  useEffect(() => {
    if (forceExpanded) setExpanded(true);
  }, [forceExpanded]);

  useEffect(() => {
    if (periodShouldExpand(period, user, viewMode)) setExpanded(true);
  }, [period, user, viewMode, refreshToken]);

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
          {attention && <p className="text-xs text-amber-900 pt-3">{attention}</p>}
          {period.start_date &&
            (period.status === "draft" ||
              period.status === "open" ||
              period.status === "assignment") && (
              <Link
                to={coordinatePathForPeriod(period.start_date, period.id)}
                className="inline-block text-xs font-medium text-slate-700 underline hover:text-slate-900"
              >
                View weeks on calendar →
              </Link>
            )}
          <AssignmentPanel
            period={period}
            user={user}
            isCoordinator
            onChanged={onChanged}
            refreshToken={refreshToken}
            embedded
            preferredWeekId={syncedWeekId}
          />
          {period.status === "draft" && (
            <DraftPanel
              period={period}
              user={user}
              viewMode={viewMode}
              onChanged={onChanged}
              onDraftAction={onDraftAction}
              refreshToken={refreshToken}
              embedded
              pickOccupancy={pickOccupancy}
              onPickOccupancyChange={onPickOccupancyChange}
              coordOccupancy={coordOccupancy}
              onCoordOccupancyChange={onCoordOccupancyChange}
              preferredWeekId={syncedWeekId}
            />
          )}
        </div>
      )}

      {!expanded && (
        <div className="px-4 pb-3 border-t border-slate-100 pt-3">
          <AssignmentPanel
            period={period}
            user={user}
            isCoordinator
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
  viewMode,
  onChanged,
  onDraftAction,
  refreshToken,
  expandPeriodId,
  pickOccupancy,
  onPickOccupancyChange,
  coordOccupancy,
  onCoordOccupancyChange,
  preferredWeekId = null,
  preferredPeriodId = null,
}: Props) {
  const visible = sidebarPeriods(periods);
  if (visible.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-800">Period activity</h2>
      <p className="text-xs text-slate-500">
        Run the draft, assign remaining weeks, and publish the schedule.
      </p>
      {visible.map((period) => (
        <PeriodToolsCard
          key={period.id}
          period={period}
          user={user}
          viewMode={viewMode}
          onChanged={onChanged}
          onDraftAction={onDraftAction}
          refreshToken={refreshToken}
          forceExpanded={expandPeriodId === period.id}
          pickOccupancy={pickOccupancy}
          onPickOccupancyChange={onPickOccupancyChange}
          coordOccupancy={coordOccupancy}
          onCoordOccupancyChange={onCoordOccupancyChange}
          preferredWeekId={preferredWeekId}
          preferredPeriodId={preferredPeriodId}
        />
      ))}
    </div>
  );
}
