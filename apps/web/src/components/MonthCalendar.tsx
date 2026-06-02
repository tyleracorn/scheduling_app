import type { CalendarNote, CalendarWeek, OccupancyIndicator } from "../lib/calendar-types";
import {
  assignmentsForDay,
  buildMonthGrid,
  householdInitial,
  notesForDay,
  occupancyForDay,
  schedulingWeekBoundariesForDay,
  weekdayHeaders,
  weekForDay,
} from "../lib/calendar-utils";
import { occupancyCellChrome, occupancyPillClass } from "../lib/occupancy-display";
import { getOccupancyDisplayStrength } from "../lib/preferences";

type Props = {
  year: number;
  month: number;
  weeks: CalendarWeek[];
  notes: CalendarNote[];
  occupancy: OccupancyIndicator[];
  onSelectDay: (date: Date, week: CalendarWeek | null) => void;
};

function assignmentLabel(name: string, compact: boolean): string {
  if (!compact) return name;
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.length > 6 ? `${name.slice(0, 5)}…` : name;
  return words.map((w) => w.charAt(0).toUpperCase()).join("");
}

export function MonthCalendar({ year, month, weeks, notes, occupancy, onSelectDay }: Props) {
  const grid = buildMonthGrid(year, month);
  const headers = weekdayHeaders();
  const displayStrength = getOccupancyDisplayStrength();
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="bg-white rounded-none sm:rounded-lg border-y sm:border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {headers.map((h) => (
          <div key={h} className="py-1.5 sm:py-2 text-center text-[10px] sm:text-xs font-medium text-slate-600">
            <span className="sm:hidden">{h.charAt(0)}</span>
            <span className="hidden sm:inline">{h}</span>
          </div>
        ))}
      </div>
      {grid.map((row, ri) => (
        <div key={ri} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
          {row.map((date, ci) => {
            if (!date) {
              return <div key={ci} className="min-h-[76px] sm:min-h-[92px] bg-slate-50/50" />;
            }
            const dayAssignments = assignmentsForDay(date, weeks);
            const week = weekForDay(date, weeks);
            const unassigned = week && !week.assignment;
            const dayNum = date.getUTCDate();
            const dayNotes = notesForDay(date, notes);
            const dayOccupancy = occupancyForDay(date, occupancy);
            const occChrome = occupancyCellChrome(displayStrength, dayOccupancy);
            const boundaries = schedulingWeekBoundariesForDay(date, weeks);
            const hasStart = boundaries.some((b) => b.kind === "start");
            const hasEnd = boundaries.some((b) => b.kind === "end");
            const isHandoff = hasStart && hasEnd;
            const multiAssignment = dayAssignments.length > 1;
            const compactAssignment = multiAssignment || displayStrength === "subtle";
            const visibleOccupancy = dayOccupancy.slice(0, occChrome.maxPills);
            const hiddenOccupancy = dayOccupancy.length - visibleOccupancy.length;

            return (
              <button
                key={ci}
                type="button"
                onClick={() => onSelectDay(date, week)}
                className={`min-h-[76px] sm:min-h-[92px] p-0.5 sm:p-1 text-left border-r border-slate-100 last:border-r-0 hover:bg-slate-50/80 transition-colors flex flex-col ${
                  hasStart ? "border-l-[3px] border-l-indigo-500" : ""
                } ${hasEnd ? "border-r-[3px] border-r-slate-400" : ""} ${
                  isHandoff ? "bg-violet-50/40" : ""
                } ${occChrome.cellClass}`}
              >
                <div className="flex justify-between items-start gap-0.5 shrink-0">
                  <span className="text-xs text-slate-500">{dayNum}</span>
                  <span className="flex flex-col items-end gap-0.5">
                    {hasStart && (
                      <span
                        className="text-[8px] font-medium text-indigo-700 bg-indigo-100 px-0.5 rounded leading-tight"
                        title={`Scheduling week starts (${week?.week_start_date})`}
                      >
                        Wk▸
                      </span>
                    )}
                    {hasEnd && (
                      <span
                        className="text-[8px] font-medium text-slate-600 bg-slate-100 px-0.5 rounded leading-tight"
                        title={`Scheduling week ends / handoff (${week?.week_end_date})`}
                      >
                        ◂Wk
                      </span>
                    )}
                    {dayNotes.length > 0 && (
                      <span
                        className="text-[9px] bg-blue-100 text-blue-800 rounded px-1"
                        title={`${dayNotes.length} note(s)`}
                      >
                        {dayNotes.length}n
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex-1 min-h-0 flex flex-col justify-end gap-0.5 mt-0.5">
                  {dayAssignments.map(({ week, assignment }) => (
                    <div
                      key={`${week.period_week_id}-${assignment.household_id}`}
                      className="rounded px-1 py-0.5 text-[10px] font-medium text-white truncate leading-tight"
                      style={{ backgroundColor: assignment.color }}
                      title={assignment.household_name}
                    >
                      {assignmentLabel(assignment.household_name, compactAssignment)}
                    </div>
                  ))}

                  {unassigned && week.period_status === "assignment" && dayAssignments.length === 0 && (
                    <div className="rounded px-1 py-0.5 text-[10px] border border-dashed border-amber-500 text-amber-700 bg-amber-50">
                      Unassigned
                    </div>
                  )}
                  {unassigned && week.period_status === "draft" && dayAssignments.length === 0 && (
                    <div className="rounded px-1 py-0.5 text-[10px] border border-dashed border-indigo-300 text-indigo-600">
                      Pick
                    </div>
                  )}
                  {unassigned &&
                    week.period_status !== "draft" &&
                    week.period_status !== "assignment" &&
                    dayAssignments.length === 0 && (
                      <div className="rounded px-1 py-0.5 text-[10px] border border-dashed border-slate-300 text-slate-400">
                        Open
                      </div>
                    )}

                  {visibleOccupancy.length > 0 && (
                    <div
                      className={`flex flex-wrap gap-0.5 ${
                        displayStrength === "subtle" ? "justify-end" : "justify-start"
                      }`}
                      title={dayOccupancy.map((o) => `${o.household_name}: ${o.status}`).join(", ")}
                    >
                      {visibleOccupancy.map((o) =>
                        displayStrength === "subtle" ? (
                          <span
                            key={o.id}
                            className={`inline-block ${occChrome.pillClass} ${occupancyPillClass(o.status, displayStrength)}`}
                            title={`${o.household_name} (${o.status})`}
                            aria-hidden
                          />
                        ) : (
                          <span
                            key={o.id}
                            className={`inline-flex items-center ${occChrome.pillClass} ${occupancyPillClass(o.status, displayStrength)}`}
                            title={`${o.household_name} (${o.status})`}
                          >
                            {displayStrength === "strong"
                              ? o.household_name.length > 9
                                ? `${o.household_name.slice(0, 8)}…`
                                : o.household_name
                              : householdInitial(o.household_name)}
                          </span>
                        ),
                      )}
                      {hiddenOccupancy > 0 && (
                        <span className="text-[8px] text-slate-500 font-medium">+{hiddenOccupancy}</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ))}
      <p className="sr-only">Calendar for {monthLabel}</p>
    </div>
  );
}
