import { useState } from "react";
import { api } from "../lib/api";
import type { Period } from "../lib/period-types";
import { WeekSelect } from "./WeekSelect";

type StartDraftDialogProps = {
  period: Period;
  onClose: () => void;
  onStarted: (period: Period) => void;
};

export function StartDraftDialog({ period, onClose, onStarted }: StartDraftDialogProps) {
  const [weekId, setWeekId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const weeks = (period.weeks ?? []).map((week) => ({
    period_week_id: week.id,
    week_start_date: week.week_start_date,
    week_end_date: week.week_end_date,
  }));

  async function startDraft() {
    setBusy(true);
    setError(null);
    try {
      await api.startDraft(period.id, weekId || undefined);
      onStarted(period);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start draft failed");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-draft-title"
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
        }}
      >
        <h2 id="start-draft-title" className="text-lg font-semibold text-slate-900">
          Start draft
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Worker Bee is usually assigned after the pick rounds, before you publish. Reserve a week
          now only if you already know it. Households will be notified when the draft starts.
        </p>

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4">
          {weeks.length > 0 ? (
            <WeekSelect
              weeks={weeks}
              value={weekId}
              onChange={setWeekId}
              label="Worker Bee week"
              emptyLabel="Assign later"
              selectClassName="w-full rounded border border-slate-300 bg-white px-2 py-1.5"
            />
          ) : (
            <p className="text-sm text-slate-600">
              No weeks are listed for this period. You can still start the draft and assign Worker
              Bee afterward.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void startDraft()}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Starting…" : "Start draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
