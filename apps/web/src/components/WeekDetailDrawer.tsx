import type { CalendarWeek } from "../lib/calendar-types";

type Props = {
  week: CalendarWeek | null;
  dateLabel: string | null;
  onClose: () => void;
};

export function WeekDetailDrawer({ week, dateLabel, onClose }: Props) {
  if (!week && !dateLabel) return null;

  const a = week?.assignment;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/30"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-white shadow-xl p-6 overflow-y-auto"
        role="dialog"
        aria-label="Week details"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-lg font-semibold">Week details</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 text-sm"
          >
            Close
          </button>
        </div>

        {dateLabel && <p className="text-sm text-slate-600 mb-4">{dateLabel}</p>}

        {week ? (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">Week</dt>
            <dd className="font-medium">
              {week.week_start_date} — {week.week_end_date}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Period</dt>
            <dd className="font-medium">{week.period_name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Assignment</dt>
            <dd className="font-medium flex items-center gap-2 mt-1">
              {a ? (
                <>
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: a.color }}
                  />
                  {a.household_name}
                  <span className="text-slate-400 font-normal">({a.source.replace("_", " ")})</span>
                </>
              ) : (
                <span className="text-slate-400">Unassigned</span>
              )}
            </dd>
          </div>
        </dl>
        ) : (
          <p className="text-sm text-slate-500">No scheduled week includes this day.</p>
        )}
      </div>
    </div>
  );
}
