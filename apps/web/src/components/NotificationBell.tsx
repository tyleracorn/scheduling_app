import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { NotificationItem } from "../lib/api";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadCount = useCallback(async () => {
    try {
      const res = await api.notificationUnreadCount();
      setCount(res.count);
    } catch {
      /* ignore */
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.notifications();
      setItems(res.notifications);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCount();
    const interval = window.setInterval(() => void loadCount(), 60_000);
    return () => window.clearInterval(interval);
  }, [loadCount]);

  useEffect(() => {
    if (!open) return;
    void loadItems();
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, loadItems]);

  async function markRead(id: string) {
    await api.markNotificationRead(id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    void loadCount();
  }

  async function markAllRead() {
    await api.markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    setCount(0);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative text-slate-600 hover:text-slate-900"
        aria-label={`Notifications${count > 0 ? `, ${count} unread` : ""}`}
      >
        Notifications
        {count > 0 && (
          <span className="absolute -top-1 -right-2 min-w-[1rem] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] leading-4 text-center">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="text-sm font-medium text-slate-800">Inbox</span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-indigo-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          {loading ? (
            <p className="p-3 text-sm text-slate-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No notifications.</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`px-3 py-2 border-b border-slate-50 text-sm ${n.read_at ? "opacity-70" : "bg-indigo-50/40"}`}
                >
                  <p className="font-medium text-slate-800">{n.title}</p>
                  <p className="text-slate-600 text-xs mt-0.5">{n.body}</p>
                  {!n.read_at && (
                    <button
                      type="button"
                      onClick={() => void markRead(n.id)}
                      className="text-xs text-indigo-600 mt-1 hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
