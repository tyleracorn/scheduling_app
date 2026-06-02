import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AuthUser } from "../lib/api";
import type { CalendarPeriod } from "../lib/calendar-types";
import type { DraftState } from "../lib/period-types";
import {
  defaultOccupancyPick,
  occupancyPickToApi,
  type OccupancyPick,
} from "../lib/occupancy-choice";
import { OccupancyChoice } from "./OccupancyChoice";

type Props = {
  period: CalendarPeriod;
  user: AuthUser;
  isCoordinator: boolean;
  onChanged: () => void;
  refreshToken?: number;
};

function findCompletedPick(draft: DraftState, householdId: string | null) {
  if (!householdId) return null;
  return (
    draft.turns.find(
      (t) =>
        t.household_id === householdId &&
        t.status === "completed" &&
        (t.action === "pick" || t.action === "coordinator_pick") &&
        t.period_week_id,
    ) ?? null
  );
}

export function DraftPanel({ period, user, isCoordinator, onChanged, refreshToken }: Props) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [reviseWeek, setReviseWeek] = useState("");
  const [pickOccupancy, setPickOccupancy] = useState<OccupancyPick>(() => defaultOccupancyPick());
  const [reviseOccupancy, setReviseOccupancy] = useState<OccupancyPick>(() => defaultOccupancyPick());
  const [coordOccupancy, setCoordOccupancy] = useState<OccupancyPick>(() => defaultOccupancyPick());

  const load = useCallback(async () => {
    if (period.status !== "draft") {
      setDraft(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.draft(period.id);
      setDraft(res.draft);
      const pending = res.draft.active_turn?.period_week_id;
      setSelectedWeek(pending ?? "");
      const myPick = findCompletedPick(res.draft, user.householdId);
      setReviseWeek(myPick?.period_week_id ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load draft");
    } finally {
      setLoading(false);
    }
  }, [period.id, period.status, refreshToken, user.householdId]);

  useEffect(() => {
    void load();
  }, [load]);

  function occupancyPickForRevise(pick: OccupancyPick): "green" | "red" | null {
    if (pick === "none") return null;
    return pick;
  }

  function occupancyApi(pick: OccupancyPick) {
    return occupancyPickToApi(pick);
  }

  async function run(action: () => Promise<{ draft: DraftState }>) {
    setBusy(true);
    setError(null);
    try {
      const res = await action();
      setDraft(res.draft);
      setSelectedWeek(res.draft.active_turn?.period_week_id ?? "");
      const myPick = findCompletedPick(res.draft, user.householdId);
      setReviseWeek(myPick?.period_week_id ?? "");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (period.status !== "draft") return null;
  if (loading) return <p className="text-sm text-slate-500">Loading draft…</p>;
  if (!draft) return null;

  const turn = draft.active_turn;
  const isMyTurn = turn && user.householdId === turn.household_id;
  const canAct = isMyTurn && !draft.on_hold;
  const hasPendingPick = turn?.pending_pick ?? false;
  const myCompletedPick = findCompletedPick(draft, user.householdId);
  const reviseOptions = myCompletedPick
    ? [
        ...draft.open_weeks,
        ...(myCompletedPick.period_week_id &&
        !draft.open_weeks.some((w) => w.period_week_id === myCompletedPick.period_week_id)
          ? [
              {
                period_week_id: myCompletedPick.period_week_id,
                week_start_date: myCompletedPick.week_start_date ?? "",
                week_end_date: myCompletedPick.week_end_date ?? "",
              },
            ]
          : []),
      ]
    : [];

  return (
    <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-4 text-sm text-indigo-950">
      <h2 className="font-semibold text-base mb-2">Draft — {draft.period_name}</h2>
      <p className="mb-3 text-indigo-800">
        Choose a week, then confirm your pick or skip. You can change your selection before confirming,
        or revise a confirmed pick to another open week (or release it) while the draft is still
        running.
      </p>

      {error && (
        <p className="mb-2 text-red-700" role="alert">
          {error}
        </p>
      )}

      {draft.on_hold ? (
        <p className="mb-3">
          Draft is on hold after consecutive auto-skips. A coordinator must resume or take action.
        </p>
      ) : turn ? (
        <p className="mb-3">
          Round {draft.current_round} of {draft.max_rounds}:{" "}
          <strong>{turn.household_name}</strong>
          {isMyTurn ? " (your turn)" : ""}
          {turn.expires_at && (
            <span className="block text-indigo-800 mt-1">
              Deadline: {new Date(turn.expires_at).toLocaleString()}
            </span>
          )}
          {hasPendingPick && turn.pending_week && (
            <span className="block text-indigo-900 mt-1 font-medium">
              Selected: {turn.pending_week.week_start_date} – {turn.pending_week.week_end_date}
            </span>
          )}
        </p>
      ) : (
        <p className="mb-3">No active turn — draft may be finishing.</p>
      )}

      {canAct && turn && (
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">{hasPendingPick ? "Change week" : "Pick a week"}</span>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="rounded border border-indigo-300 bg-white px-2 py-1.5 min-w-[12rem]"
            >
              <option value="">Select week…</option>
              {draft.available_weeks.map((w) => (
                <option key={w.period_week_id} value={w.period_week_id}>
                  {w.week_start_date} – {w.week_end_date}
                </option>
              ))}
            </select>
          </label>
          {!hasPendingPick ? (
            <button
              type="button"
              disabled={busy || !selectedWeek}
              onClick={() =>
                void run(() => api.pickWeek(period.id, turn.id, selectedWeek))
              }
              className="rounded bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Pick week
            </button>
          ) : (
            <>
              <OccupancyChoice
                value={pickOccupancy}
                onChange={setPickOccupancy}
                scopeLabel="for this week"
                compact
              />
              <button
                type="button"
                disabled={busy || !selectedWeek || selectedWeek === turn.period_week_id}
                onClick={() =>
                  void run(() => api.changePick(period.id, turn.id, selectedWeek))
                }
                className="rounded border border-indigo-500 px-3 py-1.5 hover:bg-indigo-100 disabled:opacity-50"
              >
                Change pick
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    api.confirmPick(period.id, turn.id, occupancyApi(pickOccupancy)),
                  )
                }
                className="rounded bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Confirm pick
              </button>
            </>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => api.skipTurn(period.id, turn.id))}
            className="rounded border border-indigo-400 px-3 py-1.5 hover:bg-indigo-100 disabled:opacity-50"
          >
            Skip
          </button>
        </div>
      )}

      {myCompletedPick && (
        <div className="mb-3 pt-3 border-t border-indigo-200">
          <p className="text-xs font-medium text-indigo-800 mb-2">Your confirmed pick</p>
          <p className="mb-2 text-indigo-900">
            {myCompletedPick.week_start_date} – {myCompletedPick.week_end_date}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <OccupancyChoice
              value={reviseOccupancy}
              onChange={setReviseOccupancy}
              scopeLabel="for the new week"
              compact
            />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Move to week</span>
              <select
                value={reviseWeek}
                onChange={(e) => setReviseWeek(e.target.value)}
                className="rounded border border-indigo-300 bg-white px-2 py-1.5 min-w-[12rem]"
              >
                <option value="">Select week…</option>
                {reviseOptions.map((w) => (
                  <option key={w.period_week_id} value={w.period_week_id}>
                    {w.week_start_date} – {w.week_end_date}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={
                busy ||
                !reviseWeek ||
                reviseWeek === myCompletedPick.period_week_id
              }
              onClick={() =>
                void run(() =>
                  api.revisePick(
                    period.id,
                    myCompletedPick.id,
                    reviseWeek,
                    occupancyPickForRevise(reviseOccupancy),
                  ),
                )
              }
              className="rounded border border-indigo-500 px-3 py-1.5 hover:bg-indigo-100 disabled:opacity-50"
            >
              Change week
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(() => api.revisePick(period.id, myCompletedPick.id, null))
              }
              className="rounded border border-red-300 px-3 py-1.5 text-red-800 hover:bg-red-50 disabled:opacity-50"
            >
              Release pick
            </button>
          </div>
        </div>
      )}

      {isCoordinator && draft.on_hold && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => api.resumeDraft(period.id, true))}
          className="rounded bg-amber-600 px-3 py-1.5 text-white hover:bg-amber-700 disabled:opacity-50 mr-2"
        >
          Resume draft
        </button>
      )}

      {isCoordinator && turn && !draft.on_hold && (
        <div className="flex flex-wrap items-end gap-3 mt-2 pt-2 border-t border-indigo-200">
          <span className="text-xs font-medium text-indigo-800 w-full">Coordinator</span>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="rounded border border-indigo-300 bg-white px-2 py-1.5 min-w-[12rem]"
          >
            <option value="">Select week…</option>
            {draft.available_weeks.map((w) => (
              <option key={w.period_week_id} value={w.period_week_id}>
                {w.week_start_date} – {w.week_end_date}
              </option>
            ))}
          </select>
          <OccupancyChoice
            value={coordOccupancy}
            onChange={setCoordOccupancy}
            scopeLabel={`for ${turn.household_name}'s week`}
            compact
          />
          <button
            type="button"
            disabled={busy || !selectedWeek}
            onClick={() =>
              void run(() =>
                api.coordinatorPick(period.id, turn.id, selectedWeek, occupancyApi(coordOccupancy)),
              )
            }
            className="rounded border border-indigo-500 px-3 py-1.5 hover:bg-indigo-100 disabled:opacity-50"
          >
            Pick for household
          </button>
          <p className="text-xs text-indigo-700 w-full">
            Assigns the week to the active household on this turn. Choose green/red sharing above or
            set individual days later on the calendar.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => api.forceSkipTurn(period.id, turn.id))}
            className="rounded border border-indigo-500 px-3 py-1.5 hover:bg-indigo-100 disabled:opacity-50"
          >
            Force skip
          </button>
        </div>
      )}
    </div>
  );
}
