import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { calendarPathForPeriod } from "../lib/period-navigation";
import type { CalendarResponse, CalendarWeek } from "../lib/calendar-types";
import { formatPeriodStatus, monthRange, notesForDay, occupancyForDay } from "../lib/calendar-utils";
import { useAuth } from "../context/AuthContext";
import { MonthCalendar } from "../components/MonthCalendar";
import { PeriodStatusBanner } from "../components/PeriodStatusBanner";
import { DayDetailDrawer } from "../components/DayDetailDrawer";
import { CalendarActionsBar } from "../components/CalendarActionsBar";
import { OccupancyDisclaimer } from "../components/OccupancyDisclaimer";
import { DraftPanel } from "../components/DraftPanel";

export function CalendarPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const today = new Date();
  const paramYear = searchParams.get("year");
  const paramMonth = searchParams.get("month");
  const initialYear = paramYear ? parseInt(paramYear, 10) : today.getUTCFullYear();
  const initialMonth = paramMonth ? parseInt(paramMonth, 10) : today.getUTCMonth();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    date: string;
    dateLabel: string;
    week: CalendarWeek | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const range = monthRange(year, month);
      const res = await api.calendar(range.start, range.end);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    if (paramYear && paramMonth != null) {
      const y = parseInt(paramYear, 10);
      const m = parseInt(paramMonth, 10);
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 0 && m <= 11) {
        setYear(y);
        setMonth(m);
      }
    }
  }, [paramYear, paramMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function goToday() {
    const t = new Date();
    setYear(t.getUTCFullYear());
    setMonth(t.getUTCMonth());
  }

  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const weekStartDay = data?.settings.week_start_day ?? 0;
  const weeks = data?.weeks ?? [];
  const notes = data?.notes ?? [];
  const occupancy = data?.occupancy ?? [];
  const range = monthRange(year, month);

  const draftPeriods =
    data?.periods.filter((p) => p.status === "draft" || p.status === "assignment") ?? [];
  const draftOutsideView = draftPeriods.filter((p) => {
    if (!p.start_date || !p.end_date) return false;
    return p.start_date > range.end || p.end_date < range.start;
  });

  const selectedDate = selected ? new Date(selected.date + "T12:00:00Z") : null;
  const drawerNotes = selectedDate ? notesForDay(selectedDate, notes) : [];
  const drawerOccupancy = selectedDate ? occupancyForDay(selectedDate, occupancy) : [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            ←
          </button>
          <span className="min-w-[10rem] text-center font-medium">{monthLabel}</span>
          <button
            type="button"
            onClick={nextMonth}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            →
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Today
          </button>
        </div>
      </div>

      <OccupancyDisclaimer />

      {draftOutsideView.length > 0 && (
        <div className="mb-4 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-3 text-sm text-indigo-950">
          {draftOutsideView.map((p) => (
            <p key={p.id}>
              <strong>{p.name}</strong> is in {formatPeriodStatus(p.status)} but its weeks are not
              in {monthLabel}.{" "}
              {p.start_date && (
                <Link
                  to={calendarPathForPeriod(p.start_date)}
                  className="font-medium text-indigo-700 underline hover:text-indigo-900"
                >
                  Go to period start →
                </Link>
              )}
            </p>
          ))}
        </div>
      )}

      {data && <PeriodStatusBanner periods={data.periods} />}

      {data &&
        user &&
        data.periods
          .filter((p) => p.status === "draft")
          .map((p) => (
            <DraftPanel
              key={p.id}
              period={p}
              user={user}
              isCoordinator={user.isCoordinator || user.isAdmin}
              onChanged={() => void load()}
            />
          ))}

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500">Loading calendar…</p>
      ) : (
        <MonthCalendar
          year={year}
          month={month}
          weekStartDay={weekStartDay}
          weeks={weeks}
          notes={notes}
          occupancy={occupancy}
          onSelectDay={(date, week) =>
            setSelected({
              date: date.toISOString().slice(0, 10),
              dateLabel: date.toLocaleDateString(undefined, {
                dateStyle: "medium",
                timeZone: "UTC",
              }),
              week,
            })
          }
        />
      )}

      {!loading && user && (
        <CalendarActionsBar
          householdId={user.householdId}
          selectedDate={selected?.date ?? null}
          monthStart={range.start}
          monthEnd={range.end}
          onNoteSaved={() => void load()}
          onOccupancySaved={() => void load()}
        />
      )}

      {selected && user && (
        <DayDetailDrawer
          date={selected.date}
          dateLabel={selected.dateLabel}
          week={selected.week}
          notes={drawerNotes}
          occupancy={drawerOccupancy}
          user={user}
          onClose={() => setSelected(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}
