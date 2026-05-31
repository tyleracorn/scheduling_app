import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { getAutoOccupancyStatus, type OccupancyStatus } from "../lib/preferences";

type Props = {
  householdId: string | null;
  selectedDate: string | null;
  monthStart: string;
  monthEnd: string;
  onNoteSaved: () => void;
  onOccupancySaved: () => void;
};

export function CalendarActionsBar({
  householdId,
  selectedDate,
  monthStart,
  monthEnd,
  onNoteSaved,
  onOccupancySaved,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const initialStart = selectedDate ?? today;

  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialStart);
  const [noteBody, setNoteBody] = useState("");
  const [occStart, setOccStart] = useState(initialStart);
  const [occEnd, setOccEnd] = useState(initialStart);
  const [occStatus, setOccStatus] = useState<OccupancyStatus | null>(null);
  const [showOccForm, setShowOccForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      setStartDate(selectedDate);
      setEndDate(selectedDate);
      setOccStart(selectedDate);
      setOccEnd(selectedDate);
    }
  }, [selectedDate]);

  function openOccupancyForm() {
    setOccStatus(getAutoOccupancyStatus());
    setShowOccForm(true);
    setError(null);
  }

  async function submitNote(e: FormEvent) {
    e.preventDefault();
    if (!householdId || !noteBody.trim()) return;
    if (startDate > endDate) {
      setError("End date must be on or after start date.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createNote({
        start_date: startDate,
        end_date: endDate,
        body: noteBody.trim(),
      });
      setNoteBody("");
      onNoteSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setBusy(false);
    }
  }

  async function submitOccupancy(e: FormEvent) {
    e.preventDefault();
    if (!householdId || !occStatus) return;
    if (occStart > occEnd) {
      setError("End date must be on or after start date.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createOccupancy({
        start_date: occStart,
        end_date: occEnd,
        status: occStatus,
      });
      setShowOccForm(false);
      setOccStatus(null);
      onOccupancySaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set occupancy");
    } finally {
      setBusy(false);
    }
  }

  if (!householdId) {
    return (
      <p className="mt-6 text-sm text-slate-500 rounded-lg border border-slate-200 bg-slate-50 p-4">
        You need to belong to a household to add notes or occupancy indicators.
      </p>
    );
  }

  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
        <h2 className="text-sm font-medium text-slate-800">Add to calendar</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Choose a date range — notes and occupancy apply to every day from start through end.
        </p>
      </div>

      <div className="p-4 space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <form onSubmit={submitNote} className="space-y-3">
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Household note</p>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm text-slate-600">
              Start
              <input
                type="date"
                required
                value={startDate}
                min={monthStart}
                max={monthEnd}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
                className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm w-full min-w-[10rem]"
              />
            </label>
            <label className="text-sm text-slate-600">
              End
              <input
                type="date"
                required
                value={endDate}
                min={startDate}
                max={monthEnd}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm w-full min-w-[10rem]"
              />
            </label>
          </div>
          <label className="block text-sm text-slate-600">
            Note
            <textarea
              required
              rows={2}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="e.g. Flexible this week, family visiting, unavailable…"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !noteBody.trim()}
            className="rounded bg-slate-800 text-white px-4 py-2 text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            Add note
          </button>
        </form>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-2">
            Occupancy
          </p>
          {!showOccForm ? (
            <button
              type="button"
              onClick={openOccupancyForm}
              className="text-sm text-slate-700 underline"
            >
              Set green/red for a date range…
            </button>
          ) : (
            <form onSubmit={submitOccupancy} className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <label className="text-sm text-slate-600">
                  Start
                  <input
                    type="date"
                    required
                    value={occStart}
                    min={monthStart}
                    max={monthEnd}
                    onChange={(e) => {
                      setOccStart(e.target.value);
                      if (e.target.value > occEnd) setOccEnd(e.target.value);
                    }}
                    className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm w-full min-w-[10rem]"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  End
                  <input
                    type="date"
                    required
                    value={occEnd}
                    min={occStart}
                    max={monthEnd}
                    onChange={(e) => setOccEnd(e.target.value)}
                    className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm w-full min-w-[10rem]"
                  />
                </label>
              </div>
              <fieldset>
                <legend className="text-sm text-slate-600 mb-2">Status</legend>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="occ-range"
                      checked={occStatus === "green"}
                      onChange={() => setOccStatus("green")}
                    />
                    Green (welcome others)
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="occ-range"
                      checked={occStatus === "red"}
                      onChange={() => setOccStatus("red")}
                    />
                    Red (prefer exclusive)
                  </label>
                </div>
              </fieldset>
              <p className="text-xs text-slate-500">
                Change your default in{" "}
                <Link to="/settings" className="underline">
                  Settings
                </Link>
                .
              </p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy || !occStatus}
                  className="rounded bg-slate-800 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Apply occupancy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOccForm(false);
                    setOccStatus(null);
                  }}
                  className="text-sm text-slate-600 px-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
