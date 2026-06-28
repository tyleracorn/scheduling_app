import { Link } from "react-router-dom";
import type { CalendarNote } from "../lib/calendar-types";
import { calendarPathForPeriod } from "../lib/period-navigation";
import { textColorForBackground } from "../lib/calendar-utils";

type Props = {
  note: CalendarNote;
  currentUserId: string | null;
  busy?: boolean;
  onDelete?: (id: string) => void;
};

function formatDateRange(start: string, end: string): string {
  if (start === end) return start;
  return `${start} — ${end}`;
}

export function NoteCard({ note, currentUserId, busy = false, onDelete }: Props) {
  const canDelete = currentUserId != null && note.created_by_user_id === currentUserId;
  const calendarLink = calendarPathForPeriod(note.start_date);

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-800">
            {note.household_name}
            {note.category_slug !== "general" && (
              <span
                className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: note.category_color,
                  color: textColorForBackground(note.category_color),
                }}
              >
                {note.category_name}
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {formatDateRange(note.start_date, note.end_date)}
            <span className="mx-1">·</span>
            <Link to={calendarLink} className="text-slate-600 hover:text-slate-900 underline">
              View on calendar
            </Link>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">By {note.created_by_name}</p>
        </div>
        {canDelete && onDelete && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete(note.id)}
            className="text-sm text-red-600 hover:underline disabled:opacity-50 shrink-0"
          >
            Delete
          </button>
        )}
      </div>
      <p className="text-slate-700 mt-2 whitespace-pre-wrap text-sm">{note.body}</p>
    </li>
  );
}
