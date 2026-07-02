import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { CalendarPeriod } from "../lib/calendar-types";
import type { AuthUser } from "../lib/api";
import {
  defaultOccupancyPick,
  occupancyPickToApi,
  type OccupancyPick,
} from "../lib/occupancy-choice";
import { OccupancyChoice } from "./OccupancyChoice";

type AssignedWeek = {
  period_week_id: string;
  week_start_date: string;
  week_end_date: string;
  household_id: string;
  household_name: string;
};

type Props = {
  period: CalendarPeriod;
  user: AuthUser;
  onChanged: () => void;
  refreshToken?: number;
  embedded?: boolean;
  /** Assignment-phase coordinator swaps only; published swaps always show occupancy + reason. */
  coordinatorAssignmentMode?: boolean;
};

export function SwapWeeksForm({
  period,
  user,
  onChanged,
  refreshToken,
  embedded = false,
  coordinatorAssignmentMode = false,
}: Props) {
  const [assignedWeeks, setAssignedWeeks] = useState<AssignedWeek[]>([]);
  const [weekA, setWeekA] = useState("");
  const [weekB, setWeekB] = useState("");
  const [swapOccA, setSwapOccA] = useState<OccupancyPick>(() => defaultOccupancyPick());
  const [swapOccB, setSwapOccB] = useState<OccupancyPick>(() => defaultOccupancyPick());
  const [swapReason, setSwapReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!embedded);

  const loadAssigned = useCallback(async () => {
    if (period.status !== "assignment" && period.status !== "published") {
      setAssignedWeeks([]);
      return;
    }
    try {
      const res = await api.assignedWeeks(period.id);
      setAssignedWeeks(res.weeks);
    } catch {
      setAssignedWeeks([]);
    }
  }, [period.id, period.status]);

  useEffect(() => {
    void loadAssigned();
  }, [loadAssigned, refreshToken]);

  const weekAInfo = assignedWeeks.find((w) => w.period_week_id === weekA);
  const weekBInfo = assignedWeeks.find((w) => w.period_week_id === weekB);

  const swapperInvolved =
    !!user.householdId &&
    !!weekAInfo &&
    !!weekBInfo &&
    (weekAInfo.household_id === user.householdId || weekBInfo.household_id === user.householdId);

  async function runSwap() {
    if (!weekA || !weekB || weekA === weekB) return;
    if (!swapReason.trim()) {
      setError("Reason is required.");
      return;
    }

    let confirmMsg = `Swap ${weekAInfo?.household_name} (${weekAInfo?.week_start_date}) with ${weekBInfo?.household_name} (${weekBInfo?.week_start_date})?\n\nReason: ${swapReason.trim()}`;
    if (!swapperInvolved && weekAInfo && weekBInfo) {
      confirmMsg =
        `You are swapping weeks between ${weekAInfo.household_name} and ${weekBInfo.household_name} — neither is your household.\n\n` +
        confirmMsg;
    }
    if (!confirm(confirmMsg)) return;

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.swapWeeks(period.id, {
        week_a_id: weekA,
        week_b_id: weekB,
        occupancy_a: occupancyPickToApi(swapOccA) ?? null,
        occupancy_b: occupancyPickToApi(swapOccB) ?? null,
        reason: swapReason.trim(),
      });
      setMessage("Weeks swapped.");
      setWeekA("");
      setWeekB("");
      setSwapReason("");
      if (embedded) setExpanded(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Swap failed");
    } finally {
      setBusy(false);
    }
  }

  if (assignedWeeks.length < 2) return null;

  const showOccupancy = period.status === "published" || coordinatorAssignmentMode;

  const panelClass = embedded
    ? "text-sm"
    : "rounded-lg border border-slate-200 bg-white px-3 sm:px-4 py-3 sm:py-4 text-sm";

  return (
    <div className={panelClass}>
      {embedded ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-sm font-medium text-slate-800 underline hover:text-slate-950"
        >
          {expanded ? "Hide swap form" : "Swap two assigned weeks…"}
        </button>
      ) : (
        <h3 className="font-semibold text-slate-900 mb-1">Swap weeks</h3>
      )}

      {expanded && (
        <div className={`space-y-3 ${embedded ? "mt-3 pt-3 border-t border-slate-200" : ""}`}>
          <p className="text-xs text-slate-600">
            Pick two assigned weeks to trade. For a 3-way rotation, run two separate swaps (e.g. A↔B,
            then B↔C). A reason is recorded for everyone to see.
          </p>

          {error && (
            <p className="text-red-700 text-xs" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="text-green-800 text-xs" role="status">
              {message}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              Week A
              <select
                value={weekA}
                onChange={(e) => setWeekA(e.target.value)}
                className="mt-1 block rounded border border-slate-300 px-2 py-1.5 min-w-[12rem] bg-white"
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
                className="mt-1 block rounded border border-slate-300 px-2 py-1.5 min-w-[12rem] bg-white"
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

          {showOccupancy && weekBInfo && weekAInfo && (
            <OccupancyChoice
              value={swapOccA}
              onChange={setSwapOccA}
              scopeLabel={`for ${weekBInfo.household_name} on ${weekAInfo.week_start_date} week`}
              compact
            />
          )}
          {showOccupancy && weekAInfo && weekBInfo && (
            <OccupancyChoice
              value={swapOccB}
              onChange={setSwapOccB}
              scopeLabel={`for ${weekAInfo.household_name} on ${weekBInfo.week_start_date} week`}
              compact
            />
          )}

          <label className="block text-sm">
            Reason (required)
            <textarea
              value={swapReason}
              onChange={(e) => setSwapReason(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
              placeholder="Agreed swap, fixing a mistake, etc."
            />
          </label>

          {!swapperInvolved && weekAInfo && weekBInfo && (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              Neither week belongs to your household. Both households will be notified.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !weekA || !weekB || !swapReason.trim()}
              onClick={() => void runSwap()}
              className="rounded bg-slate-800 px-3 py-1.5 text-white hover:bg-slate-900 disabled:opacity-50"
            >
              Swap weeks
            </button>
            {embedded && (
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-sm text-slate-600 px-2"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
