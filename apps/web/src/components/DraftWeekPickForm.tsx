import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { AuthUser } from "../lib/api";
import type { CalendarNote, CalendarPeriod } from "../lib/calendar-types";
import type { DraftState } from "../lib/period-types";
import type { CalendarViewMode } from "../lib/calendar-view-mode";
import { calendarPathForPeriod } from "../lib/period-navigation";
import { submitDraftWeekPick } from "../lib/draft-pick-actions";
import { preferredSchedulingWeekId } from "../lib/scheduling-week-select";
import {
  defaultOccupancyPick,
  occupancyPickToApi,
  type OccupancyPick,
} from "../lib/occupancy-choice";
import { OccupancyChoice } from "./OccupancyChoice";
import { WeekSelect } from "./WeekSelect";

export type DraftWeekPickFormProps = {
  period: CalendarPeriod;
  user: AuthUser;
  viewMode: CalendarViewMode;
  onChanged: () => void;
  onDraftAction?: () => void;
  refreshToken?: number;
  embedded?: boolean;
  pickOccupancy: OccupancyPick;
  onPickOccupancyChange: (value: OccupancyPick) => void;
  coordOccupancy: OccupancyPick;
  onCoordOccupancyChange: (value: OccupancyPick) => void;
  preferredWeekId?: string | null;
  /** Drawer: hide status/revise; use fixed week for pick action. */
  fixedWeekId?: string | null;
  showStatus?: boolean;
  showRevise?: boolean;
  showMemberHints?: boolean;
  showHeading?: boolean;
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

export function DraftWeekPickForm({
  period,
  user,
  viewMode,
  onChanged,
  onDraftAction,
  refreshToken,
  embedded = false,
  pickOccupancy,
  onPickOccupancyChange,
  coordOccupancy,
  onCoordOccupancyChange,
  preferredWeekId = null,
  fixedWeekId = null,
  showStatus = true,
  showRevise = true,
  showMemberHints = true,
  showHeading = true,
}: DraftWeekPickFormProps) {
  const turnSyncRef = useRef<{ turnId: string; pendingWeekId: string | null } | null>(null);
  const weekTouched = useRef(false);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [reviseWeek, setReviseWeek] = useState("");
  const [reviseOccupancy, setReviseOccupancy] = useState<OccupancyPick>(() => defaultOccupancyPick());
  const [weekNotes, setWeekNotes] = useState<CalendarNote[]>([]);

  const effectiveWeekId = fixedWeekId || selectedWeek;
  const selectedWeekMeta = draft?.available_weeks.find((w) => w.period_week_id === effectiveWeekId);

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
      const turn = res.draft.active_turn;
      if (!turn) {
        turnSyncRef.current = null;
        if (!fixedWeekId) setSelectedWeek("");
      } else {
        const pending = turn.period_week_id;
        const last = turnSyncRef.current;
        const turnChanged =
          !last || last.turnId !== turn.id || last.pendingWeekId !== pending;
        turnSyncRef.current = { turnId: turn.id, pendingWeekId: pending };
        if (!fixedWeekId) {
          setSelectedWeek((prev) => {
            if (turnChanged) return pending ?? "";
            if (prev && res.draft.available_weeks.some((w) => w.period_week_id === prev)) {
              return prev;
            }
            return pending ?? "";
          });
        }
      }
      const myPick = findCompletedPick(res.draft, user.householdId);
      setReviseWeek(myPick?.period_week_id ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load draft");
    } finally {
      setLoading(false);
    }
  }, [period.id, period.status, refreshToken, user.householdId, fixedWeekId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (fixedWeekId || !draft || weekTouched.current) return;
    const options = draft.available_weeks;
    const next = preferredSchedulingWeekId(
      preferredWeekId ? { period_week_id: preferredWeekId } : null,
      options,
    );
    if (next) setSelectedWeek(next);
  }, [preferredWeekId, draft, fixedWeekId]);

  useEffect(() => {
    if (!selectedWeekMeta) {
      setWeekNotes([]);
      return;
    }
    api
      .calendar(selectedWeekMeta.week_start_date, selectedWeekMeta.week_end_date)
      .then((res) =>
        setWeekNotes(
          res.notes.filter(
            (n) => n.category_slug === "away" || n.category_name.toLowerCase() === "away",
          ),
        ),
      )
      .catch(() => setWeekNotes([]));
  }, [selectedWeekMeta?.week_start_date, selectedWeekMeta?.week_end_date, effectiveWeekId]);

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
      if (!fixedWeekId) {
        setSelectedWeek(res.draft.active_turn?.period_week_id ?? "");
      }
      const myPick = findCompletedPick(res.draft, user.householdId);
      setReviseWeek(myPick?.period_week_id ?? "");
      onChanged();
      onDraftAction?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (period.status !== "draft") return null;
  if (loading) {
    return (
      <p className={`text-sm text-slate-500 ${embedded ? "pt-2" : ""}`}>Loading pick status…</p>
    );
  }
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

  const heading =
    viewMode === "coordinator" ? `Draft — ${draft.period_name}` : `Pick your weeks — ${draft.period_name}`;

  return (
    <div className={embedded ? "text-sm text-indigo-950" : ""}>
      {showHeading && !embedded && (
        <h2 className="font-semibold text-base mb-2">{heading}</h2>
      )}
      {viewMode === "member" && showMemberHints && !embedded && (
        <>
          <p className="mb-2 text-indigo-800">
            Click an open week on the calendar, or choose below. Set sharing, then confirm.
          </p>
          <p className="text-xs text-indigo-700 mb-3">
            Tap a day in the month grid to pick a week and set green/red sharing in one step.
          </p>
        </>
      )}

      {error && (
        <p className="mb-2 text-red-700" role="alert">
          {error}
        </p>
      )}

      {showStatus && (
        <>
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
        </>
      )}

      {viewMode === "member" && canAct && turn && hasPendingPick && turn.pending_week && (
        <p className="mb-3 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          You selected {turn.pending_week.week_start_date} – {turn.pending_week.week_end_date}. Choose
          sharing and confirm to finish your turn.
        </p>
      )}

      {viewMode === "coordinator" && isMyTurn && turn && !draft.on_hold && period.start_date && (
        <p className="mb-3 text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 rounded px-2 py-1.5">
          It&apos;s your household&apos;s turn.{" "}
          <Link to={calendarPathForPeriod(period.start_date)} className="font-medium underline">
            Pick on the Calendar →
          </Link>
        </p>
      )}

      {viewMode === "member" && canAct && turn && (
        <div className="flex flex-wrap items-end gap-3 mb-3">
          {!fixedWeekId && (
            <WeekSelect
              weeks={draft.available_weeks}
              value={selectedWeek}
              onChange={(id) => {
                weekTouched.current = true;
                setSelectedWeek(id);
              }}
            />
          )}
          <OccupancyChoice
            value={pickOccupancy}
            onChange={onPickOccupancyChange}
            scopeLabel="for this week"
            compact
          />
          {weekNotes.length > 0 && (
            <div className="w-full text-xs text-orange-900 bg-orange-50 border border-orange-200 rounded px-2 py-1.5">
              <strong>Away notes this week:</strong>{" "}
              {weekNotes.map((n) => `${n.household_name}: ${n.body}`).join(" · ")}
            </div>
          )}
          <button
            type="button"
            disabled={busy || !effectiveWeekId}
            onClick={() =>
              void run(() =>
                submitDraftWeekPick({
                  periodId: period.id,
                  turnId: turn.id,
                  periodWeekId: effectiveWeekId,
                  occupancy: pickOccupancy,
                  pendingWeekId: turn.period_week_id,
                }),
              )
            }
            className="rounded bg-indigo-600 px-3 py-1.5 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Confirm week
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

      {viewMode === "member" && showRevise && myCompletedPick && (
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
            <WeekSelect
              weeks={reviseOptions}
              value={reviseWeek}
              onChange={setReviseWeek}
              label="Move to week"
            />
            <button
              type="button"
              disabled={busy || !reviseWeek || reviseWeek === myCompletedPick.period_week_id}
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
              onClick={() => void run(() => api.revisePick(period.id, myCompletedPick.id, null))}
              className="rounded border border-red-300 px-3 py-1.5 text-red-800 hover:bg-red-50 disabled:opacity-50"
            >
              Release pick
            </button>
          </div>
        </div>
      )}

      {viewMode === "coordinator" && draft.on_hold && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => api.resumeDraft(period.id, true))}
          className="rounded bg-amber-600 px-3 py-1.5 text-white hover:bg-amber-700 disabled:opacity-50 mr-2"
        >
          Resume draft
        </button>
      )}

      {viewMode === "coordinator" && turn && !draft.on_hold && !isMyTurn && (
        <div className="flex flex-wrap items-end gap-3 mt-2 pt-2 border-t border-indigo-200">
          <span className="text-xs font-medium text-indigo-800 w-full">Coordinator</span>
          {!fixedWeekId && (
            <WeekSelect
              weeks={draft.available_weeks}
              value={selectedWeek}
              onChange={(id) => {
                weekTouched.current = true;
                setSelectedWeek(id);
              }}
            />
          )}
          <OccupancyChoice
            value={coordOccupancy}
            onChange={onCoordOccupancyChange}
            scopeLabel={`for ${turn.household_name}'s week`}
            compact
          />
          <button
            type="button"
            disabled={busy || !effectiveWeekId}
            onClick={() =>
              void run(() =>
                api.coordinatorPick(period.id, turn.id, effectiveWeekId, occupancyApi(coordOccupancy)),
              )
            }
            className="rounded border border-indigo-500 px-3 py-1.5 hover:bg-indigo-100 disabled:opacity-50"
          >
            Pick for household
          </button>
          {!embedded && (
            <p className="text-xs text-indigo-700 w-full">
              Assigns the week to the active household on this turn. Choose green/red sharing above or
              set individual days later on the calendar.
            </p>
          )}
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
