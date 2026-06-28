import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { calendarPathForPeriod } from "../lib/period-navigation";
import type { CalendarResponse, CalendarWeek } from "../lib/calendar-types";
import { formatPeriodStatus, coveringWeeksForDay, monthRange, notesForDay, occupancyForDay } from "../lib/calendar-utils";
import { getPeriodAttentionMessage, sidebarPeriods } from "../lib/period-attention";
import { useAuth } from "../context/AuthContext";
import { CalendarLegend } from "../components/CalendarLegend";
import { MonthCalendar } from "../components/MonthCalendar";
import { DayDetailDrawer } from "../components/DayDetailDrawer";
import { CalendarActionsBar } from "../components/CalendarActionsBar";
import { PeriodToolsPanel } from "../components/PeriodToolsPanel";

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
    coveringWeeks: CalendarWeek[];
  } | null>(null);
  const [draftRefresh, setDraftRefresh] = useState(0);
  const [expandPeriodId, setExpandPeriodId] = useState<string | null>(null);

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

  const refreshAll = useCallback(() => {
    void load();
    setDraftRefresh((n) => n + 1);
  }, [load]);

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
  const monthLabelShort = new Date(Date.UTC(year, month, 1)).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  const schedulingWeekStartDay = data?.settings.week_start_day ?? 0;
  const weeks = data?.weeks ?? [];
  const notes = data?.notes ?? [];
  const occupancy = data?.occupancy ?? [];
  const range = monthRange(year, month);

  const notesEarliestDate = data?.settings.notes_earliest_date ?? range.start;
  const notesLatestDate = useMemo(() => {
    const far = new Date();
    far.setUTCFullYear(far.getUTCFullYear() + 5);
    let latest = far.toISOString().slice(0, 10);
    for (const p of data?.periods ?? []) {
      if (p.end_date && p.end_date > latest) latest = p.end_date;
    }
    return latest;
  }, [data?.periods]);

  const draftPeriods =
    data?.periods.filter((p) => p.status === "draft" || p.status === "assignment") ?? [];
  const draftOutsideView = draftPeriods.filter((p) => {
    if (!p.start_date || !p.end_date) return false;
    return p.start_date > range.end || p.end_date < range.start;
  });

  const attentionAlerts = useMemo(() => {
    if (!data || !user) return [];
    return sidebarPeriods(data.periods)
      .map((p) => ({ period: p, message: getPeriodAttentionMessage(p, user) }))
      .filter((a): a is { period: (typeof a)["period"]; message: string } => a.message != null);
  }, [data, user]);

  const selectedDate = selected ? new Date(selected.date + "T12:00:00Z") : null;
  const drawerNotes = selectedDate ? notesForDay(selectedDate, notes) : [];
  const drawerOccupancy = selectedDate ? occupancyForDay(selectedDate, occupancy) : [];

  function focusPeriodPanel(periodId: string) {
    setExpandPeriodId(periodId);
    document.getElementById("period-tools-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <div className="sticky top-[44px] sm:top-[52px] z-10 -mx-2 sm:-mx-4 px-2 sm:px-4 py-2 sm:py-3 mb-3 sm:mb-4 bg-slate-50/95 backdrop-blur border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <h1 className="text-xl sm:text-2xl font-semibold">Calendar</h1>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded border border-slate-300 px-2 sm:px-3 py-1.5 text-sm hover:bg-white"
              aria-label="Previous month"
            >
              ←
            </button>
            <span className="min-w-[5.5rem] sm:min-w-[10rem] text-center font-medium text-sm sm:text-base">
              <span className="sm:hidden">{monthLabelShort}</span>
              <span className="hidden sm:inline">{monthLabel}</span>
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded border border-slate-300 px-2 sm:px-3 py-1.5 text-sm hover:bg-white"
              aria-label="Next month"
            >
              →
            </button>
            <button
              type="button"
              onClick={goToday}
              className="rounded border border-slate-300 px-2 sm:px-3 py-1.5 text-sm hover:bg-white"
            >
              Today
            </button>
          </div>
        </div>

        {attentionAlerts.length > 0 && (
          <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
            {attentionAlerts.map(({ period, message }) => (
              <button
                key={period.id}
                type="button"
                onClick={() => focusPeriodPanel(period.id)}
                className="rounded-full border border-amber-300 bg-amber-100 px-2.5 sm:px-3 py-1 text-xs font-medium text-amber-950 hover:bg-amber-200"
              >
                {message}
              </button>
            ))}
          </div>
        )}

        {draftOutsideView.length > 0 && (
          <div className="mt-2 sm:mt-3 space-y-1 text-xs sm:text-sm text-indigo-950">
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

        {error && (
          <p className="mt-2 sm:mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
        <div className="lg:col-span-2 min-w-0 -mx-2 sm:mx-0">
          {!loading && weeks.length > 0 && (
            <div className="px-2 sm:px-0">
              <CalendarLegend schedulingWeekStartDay={schedulingWeekStartDay} />
            </div>
          )}

          {loading ? (
            <p className="text-slate-500 px-2 sm:px-0">Loading calendar…</p>
          ) : (
            <MonthCalendar
              year={year}
              month={month}
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
                  coveringWeeks: coveringWeeksForDay(date, weeks),
                })
              }
            />
          )}

          {!loading && user && (
            <div className="px-2 sm:px-0 mt-3 sm:mt-4">
              <CalendarActionsBar
                householdId={user.householdId}
                selectedDate={selected?.date ?? null}
                visibleMonthStart={range.start}
                visibleMonthEnd={range.end}
                earliestDate={notesEarliestDate}
                latestDate={notesLatestDate}
                onNoteSaved={refreshAll}
                onOccupancySaved={refreshAll}
                defaultCollapsed
              />
            </div>
          )}
        </div>

        {user && data && sidebarPeriods(data.periods).length > 0 && (
          <aside id="period-tools-panel" className="mt-4 sm:mt-6 lg:mt-0 px-2 sm:px-0">
            <PeriodToolsPanel
              periods={data.periods}
              user={user}
              isCoordinator={user.isCoordinator || user.isAdmin}
              onChanged={refreshAll}
              refreshToken={draftRefresh}
              expandPeriodId={expandPeriodId}
            />
          </aside>
        )}
      </div>

      {selected && user && (
        <DayDetailDrawer
          date={selected.date}
          dateLabel={selected.dateLabel}
          week={selected.week}
          coveringWeeks={selected.coveringWeeks}
          notes={drawerNotes}
          occupancy={drawerOccupancy}
          user={user}
          isCoordinator={user.isCoordinator || user.isAdmin}
          onClose={() => setSelected(null)}
          onChanged={refreshAll}
          draftRefreshToken={draftRefresh}
        />
      )}
    </div>
  );
}
