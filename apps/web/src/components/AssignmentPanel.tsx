import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { CalendarPeriod } from "../lib/calendar-types";
import { PeriodHouseholdWeekCounts } from "./PeriodHouseholdWeekCounts";
import { AssignWeekForm } from "./AssignWeekForm";
import { SwapWeeksForm } from "./SwapWeeksForm";
import type { PeriodAssignmentSummary } from "../lib/api";
import type { AuthUser } from "../lib/api";

type Props = {
  period: CalendarPeriod;
  user: AuthUser;
  isCoordinator: boolean;
  onChanged: () => void;
  refreshToken?: number;
  embedded?: boolean;
  summaryOnly?: boolean;
  preferredWeekId?: string | null;
};

export function AssignmentPanel({
  period,
  user,
  isCoordinator,
  onChanged,
  refreshToken,
  embedded = false,
  summaryOnly = false,
  preferredWeekId = null,
}: Props) {
  const [unassignedCount, setUnassignedCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<PeriodAssignmentSummary | null>(null);

  const loadSummary = useCallback(async () => {
    if (period.status !== "assignment" && period.status !== "published" && period.status !== "draft") {
      setSummary(null);
      return;
    }
    try {
      const res = await api.assignmentSummary(period.id);
      setSummary(res);
    } catch {
      setSummary(null);
    }
  }, [period.id, period.status]);

  const load = useCallback(async () => {
    if (period.status !== "assignment") {
      setUnassignedCount(null);
      return;
    }
    try {
      const res = await api.unassignedWeeks(period.id);
      setUnassignedCount(res.weeks.length);
    } catch {
      setUnassignedCount(null);
    }
  }, [period.id, period.status]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary, refreshToken]);

  async function publish() {
    if (!confirm(`Publish ${period.name}? Everyone will see final assignments on the calendar.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.publishPeriod(period.id);
      setMessage("Period published.");
      setUnassignedCount(0);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  }

  if (period.status !== "assignment" && period.status !== "published" && period.status !== "draft") {
    return null;
  }

  const showPublish = period.status === "assignment";

  if (period.status === "draft") {
    if (!summary) return null;
    return (
      <div className={embedded ? "" : "mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"}>
        <PeriodHouseholdWeekCounts summary={summary} compact />
      </div>
    );
  }

  if (summaryOnly) {
    if (!summary) return null;
    return <PeriodHouseholdWeekCounts summary={summary} compact />;
  }

  const panelClass = embedded
    ? "text-sm text-emerald-950"
    : "mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-950";

  return (
    <div className={panelClass}>
      <h2 className="font-semibold text-base mb-2">
        {period.status === "assignment" ? "Assign remaining weeks" : "Schedule set"} — {period.name}
      </h2>

      {summary && (
        <div className="mb-3">
          <PeriodHouseholdWeekCounts summary={summary} />
        </div>
      )}

      {period.status === "assignment" && (
        <>
          <p className="mb-2 text-emerald-800">
            {unassignedCount === null
              ? "Loading unassigned weeks…"
              : unassignedCount === 0
                ? "All weeks are assigned. Ready to publish."
                : `${unassignedCount} week(s) still unassigned.`}
          </p>
          {isCoordinator && unassignedCount !== null && unassignedCount > 0 && (
            <AssignWeekForm
              period={period}
              onChanged={onChanged}
              refreshToken={refreshToken}
              embedded={embedded}
              preferredWeekId={preferredWeekId}
            />
          )}
          {isCoordinator && (
            <SwapWeeksForm
              period={period}
              user={user}
              onChanged={onChanged}
              refreshToken={refreshToken}
              embedded
              coordinatorAssignmentMode
            />
          )}
        </>
      )}

      {error && (
        <p className="mb-2 text-red-700" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-2 text-green-800" role="status">
          {message}
        </p>
      )}

      {showPublish && isCoordinator && (
        <button
          type="button"
          disabled={busy || unassignedCount === null || unassignedCount > 0}
          onClick={() => void publish()}
          className="rounded bg-emerald-700 px-3 py-1.5 text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          Publish period
        </button>
      )}
    </div>
  );
}
