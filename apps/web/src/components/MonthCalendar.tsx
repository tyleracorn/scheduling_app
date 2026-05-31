import type { CalendarWeek } from "../lib/calendar-types";
import {
  assignmentForDay,
  buildMonthGrid,
  weekdayHeaders,
  weekForDay,
} from "../lib/calendar-utils";

type Props = {
  year: number;
  month: number;
  weekStartDay: number;
  weeks: CalendarWeek[];
  onSelectDay: (date: Date, week: CalendarWeek | null) => void;
};

export function MonthCalendar({ year, month, weekStartDay, weeks, onSelectDay }: Props) {
  const grid = buildMonthGrid(year, month, weekStartDay);
  const headers = weekdayHeaders(weekStartDay);
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {headers.map((h) => (
          <div key={h} className="py-2 text-center text-xs font-medium text-slate-600">
            {h}
          </div>
        ))}
      </div>
      {grid.map((row, ri) => (
        <div key={ri} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
          {row.map((date, ci) => {
            if (!date) {
              return <div key={ci} className="min-h-[72px] bg-slate-50/50" />;
            }
            const info = assignmentForDay(date, weeks);
            const week = weekForDay(date, weeks);
            const unassigned = week && !week.assignment;
            const dayNum = date.getUTCDate();

            return (
              <button
                key={ci}
                type="button"
                onClick={() => onSelectDay(date, week)}
                className="min-h-[72px] p-1 text-left border-r border-slate-100 last:border-r-0 hover:bg-slate-50 transition-colors"
              >
                <span className="text-xs text-slate-500">{dayNum}</span>
                {info && (
                  <div
                    className="mt-1 rounded px-1 py-0.5 text-[10px] font-medium text-white truncate"
                    style={{ backgroundColor: info.assignment.color }}
                    title={info.assignment.household_name}
                  >
                    {info.assignment.household_name}
                  </div>
                )}
                {unassigned && (
                  <div className="mt-1 rounded px-1 py-0.5 text-[10px] border border-dashed border-slate-300 text-slate-400">
                    Open
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ))}
      <p className="sr-only">Calendar for {monthLabel}</p>
    </div>
  );
}
