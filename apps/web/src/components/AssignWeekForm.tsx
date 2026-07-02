import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { CalendarPeriod } from "../lib/calendar-types";
import { preferredSchedulingWeekId } from "../lib/scheduling-week-select";
import {
  defaultOccupancyPick,
  occupancyPickToApi,
  type OccupancyPick,
} from "../lib/occupancy-choice";
import { OccupancyChoice } from "./OccupancyChoice";
import { WeekSelect } from "./WeekSelect";

type Household = { id: string; name: string; color: string; is_worker_bee?: boolean };

export type AssignWeekFormProps = {
  period: CalendarPeriod;
  onChanged: () => void;
  refreshToken?: number;
  embedded?: boolean;
  preferredWeekId?: string | null;
  /** Drawer: assign this week only (hide week dropdown). */
  fixedWeekId?: string | null;
  onSuccess?: () => void;
};

export function AssignWeekForm({
  period,
  onChanged,
  refreshToken,
  embedded = false,
  preferredWeekId = null,
  fixedWeekId = null,
  onSuccess,
}: AssignWeekFormProps) {
  const weekTouched = useRef(false);
  const [weeks, setWeeks] = useState<
    { period_week_id: string; week_start_date: string; week_end_date: string }[]
  >([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedHousehold, setSelectedHousehold] = useState("");
  const [assignOccupancy, setAssignOccupancy] = useState<OccupancyPick>(() => defaultOccupancyPick());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveWeekId = fixedWeekId || selectedWeek;

  const load = useCallback(async () => {
    if (period.status !== "assignment") {
      setWeeks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.unassignedWeeks(period.id);
      setWeeks(res.weeks);
      if (!fixedWeekId) {
        setSelectedWeek((prev) => {
          if (prev && res.weeks.some((w) => w.period_week_id === prev)) return prev;
          return res.weeks[0]?.period_week_id ?? "";
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load unassigned weeks");
      setWeeks([]);
    } finally {
      setLoading(false);
    }
  }, [period.id, period.status, fixedWeekId, refreshToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api
      .households()
      .then((r) => setHouseholds(r.households))
      .catch(() => setHouseholds([]));
  }, []);

  useEffect(() => {
    if (fixedWeekId || weeks.length === 0 || weekTouched.current) return;
    const next = preferredSchedulingWeekId(
      preferredWeekId ? { period_week_id: preferredWeekId } : null,
      weeks,
    );
    if (next) setSelectedWeek(next);
  }, [preferredWeekId, weeks, fixedWeekId]);

  async function assign() {
    if (!effectiveWeekId || !selectedHousehold) return;
    setBusy(true);
    setError(null);
    try {
      await api.assignWeek(
        period.id,
        effectiveWeekId,
        selectedHousehold,
        undefined,
        occupancyPickToApi(assignOccupancy) ?? null,
      );
      onChanged();
      onSuccess?.();
      if (!fixedWeekId) {
        weekTouched.current = false;
        await load();
      }
      setSelectedHousehold("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment failed");
    } finally {
      setBusy(false);
    }
  }

  if (period.status !== "assignment") return null;
  if (loading) {
    return <p className="text-xs text-emerald-800">Loading unassigned weeks…</p>;
  }
  if (weeks.length === 0) return null;

  const showWeekInList = !fixedWeekId || weeks.some((w) => w.period_week_id === fixedWeekId);
  if (!showWeekInList && fixedWeekId) return null;

  return (
    <div className={`${embedded ? "pt-2" : "mb-3 pb-3 border-b border-emerald-200"}`}>
      {!embedded && (
        <p className="text-xs text-emerald-700 mb-2">
          Tap a day on the calendar or choose a week below to assign a household.
        </p>
      )}
      {error && (
        <p className="mb-2 text-red-700 text-xs" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-3">
        {!fixedWeekId && (
          <WeekSelect
            weeks={weeks}
            value={selectedWeek}
            onChange={(id) => {
              weekTouched.current = true;
              setSelectedWeek(id);
            }}
            label="Week to assign"
            selectClassName="rounded border border-emerald-300 bg-white px-2 py-1.5 min-w-[12rem]"
          />
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium">Household</span>
          <select
            value={selectedHousehold}
            onChange={(e) => setSelectedHousehold(e.target.value)}
            className="rounded border border-emerald-300 bg-white px-2 py-1.5 min-w-[12rem]"
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
        <button
          type="button"
          disabled={busy || !effectiveWeekId || !selectedHousehold}
          onClick={() => void assign()}
          className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          Assign week
        </button>
      </div>
    </div>
  );
}
