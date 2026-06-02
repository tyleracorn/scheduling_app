import { weekdayName } from "../lib/calendar-utils";

type Props = {
  schedulingWeekStartDay: number;
};

export function CalendarLegend({ schedulingWeekStartDay }: Props) {
  const startName = weekdayName(schedulingWeekStartDay);
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm border-l-4 border-indigo-500 bg-indigo-50/80" aria-hidden />
        Scheduling week starts ({startName})
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm border-r-4 border-slate-400 bg-slate-50" aria-hidden />
        Scheduling week ends / handoff ({startName})
      </span>
      <span className="text-slate-500">
        Month grid is always Sun–Sat; assignment weeks follow your period plan setting.
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="w-3 h-3 rounded-sm ring-2 ring-inset ring-green-400/75 bg-green-50/70"
          aria-hidden
        />
        Occupancy (green)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="w-3 h-3 rounded-sm ring-2 ring-inset ring-red-400/75 bg-red-50/70"
          aria-hidden
        />
        Occupancy (red)
      </span>
      <span className="text-slate-500">
        Handoff days can show two households (outgoing + incoming week).
      </span>
    </div>
  );
}
