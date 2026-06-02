import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { CalendarPeriod } from "../lib/calendar-types";
import {
  defaultOccupancyPick,
  occupancyPickToApi,
  type OccupancyPick,
} from "../lib/occupancy-choice";
import { OccupancyChoice } from "./OccupancyChoice";
import { PeriodHouseholdWeekCounts } from "./PeriodHouseholdWeekCounts";
import type { PeriodAssignmentSummary } from "../lib/api";

type Props = {
  period: CalendarPeriod;
  isCoordinator: boolean;
  onChanged: () => void;
  refreshToken?: number;
  embedded?: boolean;
  summaryOnly?: boolean;
};

export function AssignmentPanel({
  period,
  isCoordinator,
  onChanged,
  refreshToken,
  embedded = false,
  summaryOnly = false,
}: Props) {
  const [unassignedCount, setUnassignedCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showSwap, setShowSwap] = useState(false);
  const [assignedWeeks, setAssignedWeeks] = useState<
    {
      period_week_id: string;
      week_start_date: string;
      week_end_date: string;
      household_id: string;
      household_name: string;
    }[]
  >([]);
  const [weekA, setWeekA] = useState("");
  const [weekB, setWeekB] = useState("");
  const [swapOccA, setSwapOccA] = useState<OccupancyPick>(() => defaultOccupancyPick());
  const [swapOccB, setSwapOccB] = useState<OccupancyPick>(() => defaultOccupancyPick());
  const [swapReason, setSwapReason] = useState("");
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

  const loadAssigned = useCallback(async () => {
    if (!isCoordinator || period.status !== "assignment" && period.status !== "published") {
      setAssignedWeeks([]);
      return;
    }
    try {
      const res = await api.assignedWeeks(period.id);
      setAssignedWeeks(res.weeks);
    } catch {
      setAssignedWeeks([]);
    }
  }, [period.id, period.status, isCoordinator]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  useEffect(() => {
    void loadAssigned();
  }, [loadAssigned, refreshToken]);

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

  async function runSwap() {
    if (!weekA || !weekB || weekA === weekB) return;
    if (period.status === "published" && !swapReason.trim()) {
      setError("Reason is required when swapping published weeks.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.swapWeeks(period.id, {
        week_a_id: weekA,
        week_b_id: weekB,
        occupancy_a: occupancyPickToApi(swapOccA) ?? null,
        occupancy_b: occupancyPickToApi(swapOccB) ?? null,
        ...(period.status === "published" ? { reason: swapReason.trim() } : {}),
      });
      setMessage("Weeks swapped.");
      setShowSwap(false);
      setWeekA("");
      setWeekB("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Swap failed");
    } finally {
      setBusy(false);
    }
  }

  const weekAInfo = assignedWeeks.find((w) => w.period_week_id === weekA);
  const weekBInfo = assignedWeeks.find((w) => w.period_week_id === weekB);

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
                : `${unassignedCount} week(s) still unassigned. Click unassigned days on the calendar to assign.`}
          </p>
          <p className="text-xs text-emerald-700 mb-3">
            Tap a day in the month grid to assign a household and set green/red sharing for that week.
          </p>
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

      {isCoordinator && assignedWeeks.length >= 2 && (
        <div className="mb-3 pb-3 border-b border-emerald-200">
          {!showSwap ? (
            <button
              type="button"
              onClick={() => setShowSwap(true)}
              className="text-sm font-medium text-emerald-800 underline hover:text-emerald-950"
            >
              Swap two assigned weeks…
            </button>
          ) : (
            <div className="space-y-3 bg-white/60 rounded-md p-3 border border-emerald-200">
              <p className="text-xs font-medium text-emerald-900">Swap weeks</p>
              <div className="flex flex-wrap gap-3">
                <label className="text-sm">
                  Week A
                  <select
                    value={weekA}
                    onChange={(e) => setWeekA(e.target.value)}
                    className="mt-1 block rounded border border-emerald-300 px-2 py-1.5 min-w-[12rem]"
                  >
                    <option value="">Select…</option>
                    {assignedWeeks.map((w) => (
                      <option key={w.period_week_id} value={w.period_week_id}>
                        {w.week_start_date} – {w.week_end_date} ({w.household_name})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Week B
                  <select
                    value={weekB}
                    onChange={(e) => setWeekB(e.target.value)}
                    className="mt-1 block rounded border border-emerald-300 px-2 py-1.5 min-w-[12rem]"
                  >
                    <option value="">Select…</option>
                    {assignedWeeks
                      .filter((w) => w.period_week_id !== weekA)
                      .map((w) => (
                        <option key={w.period_week_id} value={w.period_week_id}>
                          {w.week_start_date} – {w.week_end_date} ({w.household_name})
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              {weekBInfo && weekAInfo && (
                <OccupancyChoice
                  value={swapOccA}
                  onChange={setSwapOccA}
                  scopeLabel={`for ${weekBInfo.household_name} on ${weekAInfo.week_start_date} week`}
                  compact
                />
              )}
              {weekAInfo && weekBInfo && (
                <OccupancyChoice
                  value={swapOccB}
                  onChange={setSwapOccB}
                  scopeLabel={`for ${weekAInfo.household_name} on ${weekBInfo.week_start_date} week`}
                  compact
                />
              )}
              {period.status === "published" && (
                <label className="block text-sm">
                  Reason (required)
                  <textarea
                    value={swapReason}
                    onChange={(e) => setSwapReason(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded border border-emerald-300 px-2 py-1.5"
                  />
                </label>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || !weekA || !weekB}
                  onClick={() => void runSwap()}
                  className="rounded bg-emerald-700 px-3 py-1.5 text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  Swap weeks
                </button>
                <button
                  type="button"
                  onClick={() => setShowSwap(false)}
                  className="text-sm text-emerald-800 px-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
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
