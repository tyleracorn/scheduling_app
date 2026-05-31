import { useState } from "react";
import { api } from "../lib/api";
import type { AuthUser } from "../lib/api";
import type { CalendarNote, CalendarWeek, OccupancyIndicator } from "../lib/calendar-types";
import { OccupancyDisclaimer } from "./OccupancyDisclaimer";

type Props = {
  date: string;
  dateLabel: string;
  week: CalendarWeek | null;
  notes: CalendarNote[];
  occupancy: OccupancyIndicator[];
  user: AuthUser;
  onClose: () => void;
  onChanged: () => void;
};

export function DayDetailDrawer({
  dateLabel,
  week,
  notes,
  occupancy,
  user,
  onClose,
  onChanged,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const householdId = user.householdId;

  async function removeNote(id: string) {
    setBusy(true);
    try {
      await api.deleteNote(id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  async function removeOccupancy(id: string) {
    setBusy(true);
    try {
      await api.deleteOccupancy(id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-white shadow-xl p-6 overflow-y-auto"
        role="dialog"
        aria-label="Day details"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold">{dateLabel}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm">
            Close
          </button>
        </div>

        {week && (
          <dl className="space-y-2 text-sm mb-4 pb-4 border-b border-slate-200">
            <div>
              <dt className="text-slate-500">Week assignment</dt>
              <dd className="font-medium">
                {week.assignment ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: week.assignment.color }}
                    />
                    {week.assignment.household_name}
                  </span>
                ) : (
                  <span className="text-slate-400">Unassigned · {week.period_name}</span>
                )}
              </dd>
            </div>
          </dl>
        )}

        {week?.period_status === "draft" && !week.assignment && (
          <p className="text-xs text-indigo-800 mb-3 rounded border border-indigo-200 bg-indigo-50 p-2">
            This week is part of an active draft. Pick it from the <strong>Draft</strong> panel at
            the top of the calendar, not here.
          </p>
        )}

        <p className="text-xs text-slate-500 mb-4">
          To add a note or occupancy for multiple days, use the form at the bottom of the calendar.
        </p>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <section className="mb-6">
          <h3 className="text-sm font-medium text-slate-800 mb-2">Household notes</h3>
          {notes.length === 0 && <p className="text-sm text-slate-400">No notes for this day.</p>}
          <ul className="space-y-2 mt-2">
            {notes.map((n) => (
              <li key={n.id} className="text-sm rounded border border-slate-200 p-2 bg-slate-50">
                <p className="font-medium text-slate-700">{n.household_name}</p>
                <p className="text-slate-600 mt-1 whitespace-pre-wrap">{n.body}</p>
                {n.start_date !== n.end_date && (
                  <p className="text-xs text-slate-400 mt-1">
                    {n.start_date} — {n.end_date}
                  </p>
                )}
                {householdId === n.household_id && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeNote(n.id)}
                    className="text-xs text-red-600 mt-2 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-medium text-slate-800 mb-2">Occupancy indicators</h3>
          <OccupancyDisclaimer />
          {occupancy.length === 0 && (
            <p className="text-sm text-slate-400">No indicators for this day.</p>
          )}
          <ul className="space-y-2 mt-2">
            {occupancy.map((o) => (
              <li
                key={o.id}
                className={`text-sm rounded border p-2 ${
                  o.status === "green"
                    ? "border-green-200 bg-green-50"
                    : "border-red-200 bg-red-50"
                }`}
              >
                <span className="font-medium">{o.household_name}</span>
                <span className="ml-2 text-xs uppercase">{o.status}</span>
                {o.start_date !== o.end_date && (
                  <p className="text-xs text-slate-500 mt-1">
                    {o.start_date} — {o.end_date}
                  </p>
                )}
                {householdId === o.household_id && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeOccupancy(o.id)}
                    className="text-xs text-red-600 mt-2 hover:underline block"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
