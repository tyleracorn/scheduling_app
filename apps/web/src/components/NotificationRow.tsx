import type { NotificationItem } from "../lib/api";

type Props = {
  notification: NotificationItem;
  compact?: boolean;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NotificationRow({ notification: n, compact, onMarkRead, onDelete }: Props) {
  return (
    <li
      className={`px-3 py-2 border-b border-slate-50 text-sm ${n.read_at ? "opacity-70" : "bg-indigo-50/40"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-slate-800">{n.title}</p>
        {!compact && (
          <time className="shrink-0 text-[11px] text-slate-400" dateTime={n.created_at}>
            {formatWhen(n.created_at)}
          </time>
        )}
      </div>
      <p className="text-slate-600 text-xs mt-0.5">{n.body}</p>
      <div className="flex flex-wrap gap-3 mt-1">
        {!n.read_at && (
          <button
            type="button"
            onClick={() => onMarkRead(n.id)}
            className="text-xs text-indigo-600 hover:underline"
          >
            Mark read
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(n.id)}
          className="text-xs text-slate-500 hover:text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
