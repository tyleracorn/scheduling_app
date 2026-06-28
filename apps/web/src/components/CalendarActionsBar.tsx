import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { getAutoOccupancyStatus, type OccupancyStatus } from "../lib/preferences";
import { NoteCategorySelect } from "./NoteCategorySelect";

type Props = {
  householdId: string | null;
  selectedDate: string | null;
  visibleMonthStart: string;
  visibleMonthEnd: string;
  earliestDate: string;
  latestDate: string;
  onNoteSaved: () => void;
  onOccupancySaved: () => void;
  defaultCollapsed?: boolean;
};

function defaultRangeDate(
  selectedDate: string | null,
  monthStart: string,
  monthEnd: string,
): string {
  if (selectedDate) return selectedDate;
  const today = new Date().toISOString().slice(0, 10);
  if (today >= monthStart && today <= monthEnd) return today;
  return monthStart;
}

export function CalendarActionsBar({
  householdId,
  selectedDate,
  visibleMonthStart,
  visibleMonthEnd,
  earliestDate,
  latestDate,
  onNoteSaved,
  onOccupancySaved,
  defaultCollapsed = false,
}: Props) {
  const [startDate, setStartDate] = useState(() =>
    defaultRangeDate(selectedDate, visibleMonthStart, visibleMonthEnd),
  );
  const [endDate, setEndDate] = useState(() =>
    defaultRangeDate(selectedDate, visibleMonthStart, visibleMonthEnd),
  );
  const [noteBody, setNoteBody] = useState("");
  const [noteCategoryId, setNoteCategoryId] = useState<string | null>(null);
  const [occStart, setOccStart] = useState(() =>
    defaultRangeDate(selectedDate, visibleMonthStart, visibleMonthEnd),
  );
  const [occEnd, setOccEnd] = useState(() =>
    defaultRangeDate(selectedDate, visibleMonthStart, visibleMonthEnd),
  );
  const [occStatus, setOccStatus] = useState<OccupancyStatus | null>(null);
  const [showOccForm, setShowOccForm] = useState(false);
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const next = defaultRangeDate(selectedDate, visibleMonthStart, visibleMonthEnd);
    setStartDate(next);
    setEndDate(selectedDate ?? next);
    setOccStart(next);
    setOccEnd(selectedDate ?? next);
  }, [selectedDate, visibleMonthStart, visibleMonthEnd]);

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
    if (startDate < earliestDate) {
      setError(`Notes cannot start before ${earliestDate} (history retention).`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createNote({
        start_date: startDate,
        end_date: endDate,
        body: noteBody.trim(),
        category_id: noteCategoryId,
      });
      setNoteBody("");
      setNoteCategoryId(null);
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
    if (occStart < earliestDate) {
      setError(`Occupancy cannot start before ${earliestDate} (history retention).`);
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
      <p className="mt-4 text-sm text-slate-500 rounded-lg border border-slate-200 bg-slate-50 p-4">
        You need to belong to a household to add notes or occupancy indicators.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`w-full px-4 py-3 text-left hover:bg-slate-100/80 ${expanded ? "border-b border-slate-100 bg-slate-50" : "bg-slate-50"}`}
        aria-expanded={expanded}
      >
        <h2 className="text-sm font-medium text-slate-800">
          Add note or sharing for multiple days
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {expanded
            ? "Pick a date range across scheduling periods. Click a day on the calendar to pre-fill dates."
            : "Expand to add a note or green/red sharing for a date range. For a single day, click the day on the calendar."}
        </p>
      </button>

      {expanded && (
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
                min={earliestDate}
                max={latestDate}
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
                min={startDate < earliestDate ? earliestDate : startDate}
                max={latestDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-sm w-full min-w-[10rem]"
              />
            </label>
          </div>
          <NoteCategorySelect
            value={noteCategoryId}
            onChange={setNoteCategoryId}
            disabled={busy}
          />
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
                    min={earliestDate}
                    max={latestDate}
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
                    min={occStart < earliestDate ? earliestDate : occStart}
                    max={latestDate}
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
      )}
    </div>
  );
}
