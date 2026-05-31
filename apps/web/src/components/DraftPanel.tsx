import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AuthUser } from "../lib/api";
import type { CalendarPeriod } from "../lib/calendar-types";
import type { DraftState } from "../lib/period-types";

type Props = {
  period: CalendarPeriod;
  user: AuthUser;
  isCoordinator: boolean;
  onChanged: () => void;
};

export function DraftPanel({ period, user, isCoordinator, onChanged }: Props) {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState("");

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load draft");
    } finally {
      setLoading(false);
    }
  }, [period.id, period.status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<{ draft: DraftState }>) {
    setBusy(true);
    setError(null);
    try {
      const res = await action();
      setDraft(res.draft);
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

  return (
    <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-4 text-sm text-indigo-950">
      <h2 className="font-semibold text-base mb-2">Draft — {draft.period_name}</h2>
      <p className="mb-3 text-indigo-800">
        Choose a week from the dropdown and click <strong>Pick week</strong> or <strong>Skip</strong>.
        Calendar cells are for notes and occupancy only.
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
        </p>
      ) : (
        <p className="mb-3">No active turn — draft may be finishing.</p>
      )}

      {canAct && turn && (
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Pick a week</span>
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
          <button
            type="button"
            disabled={busy || !selectedWeek}
            onClick={() =>
              void run(() => api.coordinatorPick(period.id, turn.id, selectedWeek))
            }
            className="rounded border border-indigo-500 px-3 py-1.5 hover:bg-indigo-100 disabled:opacity-50"
          >
            Pick for household
          </button>
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
