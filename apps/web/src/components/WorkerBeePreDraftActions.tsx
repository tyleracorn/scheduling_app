import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { CalendarWeek } from "../lib/calendar-types";

type WorkerBeePreDraftActionsProps = {
  weeks: CalendarWeek[];
  onChanged: () => void;
};

export function WorkerBeePreDraftActions({ weeks, onChanged }: WorkerBeePreDraftActionsProps) {
  const [workerBeeId, setWorkerBeeId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [weekId, setWeekId] = useState(weeks[0]?.period_week_id ?? "");

  useEffect(() => {
    api
      .households()
      .then((res) => {
        const workerBee = res.households.find((household) => household.is_worker_bee);
        setWorkerBeeId(workerBee?.id ?? null);
        if (!workerBee) setLoadError("Worker Bee household was not found.");
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load households");
      });
  }, []);

  useEffect(() => {
    setWeekId((current) =>
      weeks.some((week) => week.period_week_id === current)
        ? current
        : (weeks[0]?.period_week_id ?? ""),
    );
  }, [weeks]);

  const selected = weeks.find((week) => week.period_week_id === weekId) ?? weeks[0];
  if (!selected) return null;

  const assignedToWorkerBee =
    !!workerBeeId && selected.assignment?.household_id === workerBeeId;
  const takenBySomeoneElse = !!selected.assignment && !assignedToWorkerBee;

  async function assign() {
    if (!workerBeeId || !selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.assignWeek(selected.period_id, selected.period_week_id, workerBeeId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign Worker Bee");
    } finally {
      setBusy(false);
    }
  }

  async function clearWeek() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.clearWorkerBeeWeek(selected.period_id, selected.period_week_id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear Worker Bee week");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-4 pb-4 border-b border-slate-200">
      <h3 className="text-sm font-medium text-slate-800 mb-1">Worker Bee</h3>
      <p className="text-xs text-slate-600 mb-2">
        Assign a work week before the draft starts. It stays off the pick list once the draft begins.
      </p>
      {(error || loadError) && (
        <p className="mb-2 text-sm text-red-600" role="alert">
          {error ?? loadError}
        </p>
      )}
      {weeks.length > 1 && (
        <label className="mb-2 block text-sm">
          Which scheduling week?
          <select
            value={weekId}
            onChange={(event) => setWeekId(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5"
          >
            {weeks.map((week) => (
              <option key={week.period_week_id} value={week.period_week_id}>
                {week.week_start_date} – {week.week_end_date}
              </option>
            ))}
          </select>
        </label>
      )}
      {!takenBySomeoneElse && (
        <button
          type="button"
          disabled={busy || !workerBeeId}
          onClick={() => void (assignedToWorkerBee ? clearWeek() : assign())}
          className={
            assignedToWorkerBee
              ? "rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              : "rounded bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          }
        >
          {busy
            ? "Saving…"
            : assignedToWorkerBee
              ? "Clear Worker Bee week"
              : "Assign to Worker Bee"}
        </button>
      )}
    </section>
  );
}
