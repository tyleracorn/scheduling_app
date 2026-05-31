import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { CalendarResponse, CalendarWeek } from "../lib/calendar-types";
import { monthRange } from "../lib/calendar-utils";
import { MonthCalendar } from "../components/MonthCalendar";
import { PeriodStatusBanner } from "../components/PeriodStatusBanner";
import { WeekDetailDrawer } from "../components/WeekDetailDrawer";

export function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getUTCFullYear());
  const [month, setMonth] = useState(today.getUTCMonth());
  const [data, setData] = useState<CalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    week: CalendarWeek | null;
    dateLabel: string;
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

      {data && <PeriodStatusBanner periods={data.periods} />}

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
          onSelectDay={(date, week) =>
            setSelected({
              week,
              dateLabel: date.toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" }),
            })
          }
        />
      )}

      <WeekDetailDrawer
        week={selected?.week ?? null}
        dateLabel={selected?.dateLabel ?? null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
