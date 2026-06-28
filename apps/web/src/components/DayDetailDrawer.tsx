import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import type { AuthUser } from "../lib/api";
import type { CalendarNote, CalendarWeek, OccupancyIndicator } from "../lib/calendar-types";
import type { DraftState } from "../lib/period-types";
import {
  defaultOccupancyPick,
  occupancyPickToApi,
  type OccupancyPick,
} from "../lib/occupancy-choice";
import { textColorForBackground } from "../lib/calendar-utils";
import { OccupancyChoice } from "./OccupancyChoice";
import { OccupancyDisclaimer } from "./OccupancyDisclaimer";

type Household = { id: string; name: string; color: string; is_worker_bee?: boolean };

type Props = {
  date: string;
  dateLabel: string;
  week: CalendarWeek | null;
  coveringWeeks: CalendarWeek[];
  notes: CalendarNote[];
  occupancy: OccupancyIndicator[];
  user: AuthUser;
  isCoordinator: boolean;
  onClose: () => void;
  onChanged: () => void;
  draftRefreshToken?: number;
  draftPanelVisible?: boolean;
};

function findPickTurnForWeek(draft: DraftState, periodWeekId: string) {
  return draft.turns.find(
    (t) =>
      t.period_week_id === periodWeekId &&
      t.status === "completed" &&
      (t.action === "pick" || t.action === "coordinator_pick"),
  );
}

export function DayDetailDrawer({
  date,
  dateLabel,
  week,
  coveringWeeks,
  notes,
  occupancy,
  user,
  isCoordinator,
  onClose,
  onChanged,
  draftRefreshToken,
  draftPanelVisible = false,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedHousehold, setSelectedHousehold] = useState("");
  const [assignWeekId, setAssignWeekId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [reviseWeek, setReviseWeek] = useState("");
  const [pickOccupancy, setPickOccupancy] = useState<OccupancyPick>(() => defaultOccupancyPick());
  const [assignOccupancy, setAssignOccupancy] = useState<OccupancyPick>(() => defaultOccupancyPick());
  const [reviseOccupancy, setReviseOccupancy] = useState<OccupancyPick>(() => defaultOccupancyPick());
  const householdId = user.householdId;

  const assignableWeeks = useMemo(
    () =>
      coveringWeeks.filter(
        (w) => w.period_status === "assignment" || w.period_status === "published",
      ),
    [coveringWeeks],
  );

  const assignWeek = useMemo(() => {
    if (assignWeekId) {
      return assignableWeeks.find((w) => w.period_week_id === assignWeekId) ?? week;
    }
    return assignableWeeks[0] ?? week;
  }, [assignWeekId, assignableWeeks, week]);

  useEffect(() => {
    const preferred =
      week &&
      assignableWeeks.some((w) => w.period_week_id === week.period_week_id)
        ? week.period_week_id
        : (assignableWeeks[0]?.period_week_id ?? week?.period_week_id ?? "");
    setAssignWeekId(preferred);
  }, [date, week, assignableWeeks]);

  const ownsWeek = !!(week?.assignment && householdId === week.assignment.household_id);
  const myDayOccupancy = occupancy.filter((o) => o.household_id === householdId);

  const canAssign =
    isCoordinator &&
    assignWeek &&
    (assignWeek.period_status === "assignment" || assignWeek.period_status === "published");
  const isPublished = assignWeek?.period_status === "published";
  const isUnassigned = assignWeek && !assignWeek.assignment;
  const isDraftWeek = week?.period_status === "draft";

  const activeTurn = draft?.active_turn ?? null;
  const isMyActiveTurn =
    !!activeTurn && !!householdId && activeTurn.household_id === householdId && !draft?.on_hold;
  const pickTurn = week && draft ? findPickTurnForWeek(draft, week.period_week_id) : undefined;
  const canRevisePick =
    !!pickTurn &&
    (isCoordinator || (householdId != null && pickTurn.household_id === householdId));
  const reviseOptions =
    pickTurn && draft
      ? [
          ...draft.open_weeks,
          ...(pickTurn.period_week_id &&
          !draft.open_weeks.some((w) => w.period_week_id === pickTurn.period_week_id)
            ? [
                {
                  period_week_id: pickTurn.period_week_id,
                  week_start_date: pickTurn.week_start_date ?? "",
                  week_end_date: pickTurn.week_end_date ?? "",
                },
              ]
            : []),
        ]
      : [];

  useEffect(() => {
    if (!canAssign) return;
    api
      .households()
      .then((r) => setHouseholds(r.households))
      .catch(() => setHouseholds([]));
  }, [canAssign]);

  useEffect(() => {
    if (!isDraftWeek || !week) {
      setDraft(null);
      return;
    }
    api
      .draft(week.period_id)
      .then((r) => {
        setDraft(r.draft);
        const turn = findPickTurnForWeek(r.draft, week.period_week_id);
        setReviseWeek(turn?.period_week_id ?? "");
      })
      .catch(() => setDraft(null));
  }, [isDraftWeek, week, draftRefreshToken]);

  function occupancyPickForRevise(pick: OccupancyPick): "green" | "red" | null {
    if (pick === "none") return null;
    return pick;
  }

  function occupancyForAssign(pick: OccupancyPick): "green" | "red" | null {
    return occupancyPickForRevise(pick);
  }

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

  async function assignOrReassign() {
    if (!assignWeek || !selectedHousehold) return;
    if (isPublished && !reassignReason.trim()) {
      setError("Reason is required when changing a published assignment.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.assignWeek(
        assignWeek.period_id,
        assignWeek.period_week_id,
        selectedHousehold,
        isPublished ? reassignReason.trim() : undefined,
        occupancyForAssign(assignOccupancy),
      );
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setBusy(false);
    }
  }

  async function addDayNote(e: FormEvent) {
    e.preventDefault();
    if (!householdId || !noteBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.createNote({ start_date: date, end_date: date, body: noteBody.trim() });
      setNoteBody("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setBusy(false);
    }
  }

  async function pickAndConfirmThisWeek() {
    if (!week || !activeTurn || !draft) return;
    setBusy(true);
    setError(null);
    const occ = occupancyPickToApi(pickOccupancy);
    try {
      if (activeTurn.pending_pick && activeTurn.period_week_id === week.period_week_id) {
        await api.confirmPick(week.period_id, activeTurn.id, occ);
      } else if (activeTurn.pending_pick) {
        await api.changePick(week.period_id, activeTurn.id, week.period_week_id);
        await api.confirmPick(week.period_id, activeTurn.id, occ);
      } else {
        await api.pickWeek(week.period_id, activeTurn.id, week.period_week_id);
        await api.confirmPick(week.period_id, activeTurn.id, occ);
      }
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pick failed");
    } finally {
      setBusy(false);
    }
  }

  async function coordinatorPickThisWeek() {
    if (!week || !activeTurn) return;
    setBusy(true);
    setError(null);
    try {
      await api.coordinatorPick(
        week.period_id,
        activeTurn.id,
        week.period_week_id,
        occupancyPickToApi(pickOccupancy),
      );
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pick failed");
    } finally {
      setBusy(false);
    }
  }

  async function setDayOcc(status: "green" | "red" | null) {
    if (!householdId || !ownsWeek) return;
    setBusy(true);
    setError(null);
    try {
      await api.setDayOccupancy(date, status);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update occupancy");
    } finally {
      setBusy(false);
    }
  }

  async function revisePickToWeek(periodWeekId: string | null) {
    if (!week || !pickTurn) return;
    setBusy(true);
    setError(null);
    try {
      await api.revisePick(
        week.period_id,
        pickTurn.id,
        periodWeekId,
        periodWeekId ? occupancyPickForRevise(reviseOccupancy) : undefined,
      );
      onChanged();
      if (periodWeekId === null) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revise pick");
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
              <dt className="text-slate-500">Scheduling week</dt>
              <dd className="text-xs text-slate-600 mb-2">
                {week.week_start_date} – {week.week_end_date}
                <span className="block text-slate-400 mt-0.5">
                  Starts on {week.week_start_date}; ends / handoff on {week.week_end_date}
                </span>
              </dd>
            </div>
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
                    {week.period_status === "published" && week.assignment.source === "coordinator_edit" && (
                      <span className="text-xs text-amber-700 font-normal">(updated)</span>
                    )}
                  </span>
                ) : (
                  <span className="text-amber-700 font-medium">Unassigned · {week.period_name}</span>
                )}
              </dd>
            </div>
          </dl>
        )}

        {isDraftWeek && week && draftPanelVisible && (
          <section className="mb-4 pb-4 border-b border-indigo-200">
            <p className="text-sm text-indigo-900">
              Week picking is in the <strong>Period activity</strong> panel beside the calendar. Use
              this drawer to view day details and add notes.
            </p>
          </section>
        )}

        {isDraftWeek && week && isUnassigned && isMyActiveTurn && activeTurn && !draftPanelVisible && (
          <section className="mb-4 pb-4 border-b border-indigo-200">
            <h3 className="text-sm font-medium text-indigo-900 mb-2">Draft — your turn</h3>
            <p className="text-xs text-indigo-800 mb-2">
              Pick this scheduling week for your household.
            </p>
            <OccupancyChoice
              value={pickOccupancy}
              onChange={setPickOccupancy}
              scopeLabel="for this week"
              compact
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void pickAndConfirmThisWeek()}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {activeTurn.pending_pick && activeTurn.period_week_id === week.period_week_id
                ? "Confirm this week"
                : "Pick this week"}
            </button>
          </section>
        )}

        {isDraftWeek && week && isUnassigned && isCoordinator && activeTurn && !isMyActiveTurn && !draft?.on_hold && !draftPanelVisible && (
          <section className="mb-4 pb-4 border-b border-indigo-200">
            <h3 className="text-sm font-medium text-indigo-900 mb-2">Draft — coordinator</h3>
            <p className="text-xs text-indigo-800 mb-2">
              Pick this week for <strong>{activeTurn.household_name}</strong> (active turn).
            </p>
            <OccupancyChoice
              value={pickOccupancy}
              onChange={setPickOccupancy}
              scopeLabel={`for ${activeTurn.household_name}'s week`}
              compact
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void coordinatorPickThisWeek()}
              className="rounded border border-indigo-500 px-3 py-1.5 text-sm hover:bg-indigo-50 disabled:opacity-50"
            >
              Pick for {activeTurn.household_name}
            </button>
          </section>
        )}

        {isDraftWeek && week && canRevisePick && pickTurn && !draftPanelVisible && (
          <section className="mb-4 pb-4 border-b border-indigo-200">
            <h3 className="text-sm font-medium text-indigo-900 mb-2">
              {pickTurn.household_id === householdId ? "Your pick" : `${pickTurn.household_name}'s pick`}
            </h3>
            <p className="text-xs text-indigo-800 mb-2">
              Move to another open week or release this week back to the pool while the draft is running.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <OccupancyChoice
                value={reviseOccupancy}
                onChange={setReviseOccupancy}
                scopeLabel="for the new week"
                compact
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium">Week</span>
                <select
                  value={reviseWeek}
                  onChange={(e) => setReviseWeek(e.target.value)}
                  className="rounded border border-indigo-300 bg-white px-2 py-1.5 min-w-[10rem]"
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
                disabled={busy || !reviseWeek || reviseWeek === pickTurn.period_week_id}
                onClick={() => void revisePickToWeek(reviseWeek)}
                className="rounded border border-indigo-500 px-3 py-1.5 text-sm hover:bg-indigo-50 disabled:opacity-50"
              >
                Change week
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void revisePickToWeek(null)}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                Release pick
              </button>
            </div>
          </section>
        )}

        {canAssign && assignWeek && (
          <section className="mb-4 pb-4 border-b border-slate-200">
            <h3 className="text-sm font-medium text-slate-800 mb-2">
              {isUnassigned ? "Assign week" : "Reassign week"}
            </h3>
            {assignableWeeks.length > 1 && (
              <label className="block text-sm mb-2">
                Which scheduling week?
                <span className="block text-xs font-normal text-slate-500 mt-0.5 mb-1">
                  This day is a handoff between two weeks — choose which week to assign.
                </span>
                <select
                  value={assignWeekId}
                  onChange={(e) => setAssignWeekId(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
                >
                  {assignableWeeks.map((w) => (
                    <option key={w.period_week_id} value={w.period_week_id}>
                      {w.week_start_date} – {w.week_end_date} ({w.period_name})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm mb-2">
              Household
              <select
                value={selectedHousehold}
                onChange={(e) => setSelectedHousehold(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
              >
                <option value="">Select household…</option>
                {households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                    {h.is_worker_bee ? " (group)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <OccupancyChoice
              value={assignOccupancy}
              onChange={setAssignOccupancy}
              scopeLabel="for the assigned household this week"
              compact
            />
            {isPublished && (
              <label className="block text-sm mb-2">
                Reason (required)
                <textarea
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
                  placeholder="Agreed swap, etc."
                />
              </label>
            )}
            <button
              type="button"
              disabled={busy || !selectedHousehold}
              onClick={() => void assignOrReassign()}
              className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {isUnassigned ? "Assign" : "Reassign"}
            </button>
          </section>
        )}

        {ownsWeek && householdId && (
          <section className="mb-4 pb-4 border-b border-slate-200">
            <h3 className="text-sm font-medium text-slate-800 mb-1">Sharing on this day</h3>
            <p className="text-xs text-slate-500 mb-2">
              Your week — set whether you are fine with others joining on <strong>{date}</strong> only.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void setDayOcc("green")}
                className="rounded bg-green-600 px-3 py-1.5 text-xs text-white hover:bg-green-700 disabled:opacity-50"
              >
                Green this day
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void setDayOcc("red")}
                className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
              >
                Red this day
              </button>
              {myDayOccupancy.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setDayOcc(null)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  Clear this day
                </button>
              )}
            </div>
          </section>
        )}

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {householdId ? (
          <section className="mb-6 pb-4 border-b border-slate-200">
            <h3 className="text-sm font-medium text-slate-800 mb-2">Add a note for this day</h3>
            <form onSubmit={addDayNote} className="space-y-2">
              <textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                rows={3}
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Who's coming, plans, etc."
              />
              <button
                type="submit"
                disabled={busy || !noteBody.trim()}
                className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-50"
              >
                Add note
              </button>
            </form>
            <p className="text-xs text-slate-500 mt-2">
              For a date range, expand &ldquo;Add note or sharing for multiple days&rdquo; below the
              calendar.
            </p>
          </section>
        ) : (
          <p className="text-xs text-slate-500 mb-4">
            Join a household to add notes for this day.
          </p>
        )}

        <section className="mb-6">
          <h3 className="text-sm font-medium text-slate-800 mb-2">Household notes</h3>
          {notes.length === 0 && <p className="text-sm text-slate-400">No notes for this day.</p>}
          <ul className="space-y-2 mt-2">
            {notes.map((n) => (
              <li key={n.id} className="text-sm rounded border border-slate-200 p-2 bg-slate-50">
                <p className="font-medium text-slate-700">
                  {n.household_name}
                  {n.category_slug !== "general" && (
                    <span
                      className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: n.category_color,
                        color: textColorForBackground(n.category_color),
                      }}
                    >
                      {n.category_name}
                    </span>
                  )}
                </p>
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
