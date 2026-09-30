import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { NotificationItem } from "../lib/api";
import { NotificationRow } from "../components/NotificationRow";

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.notifications();
      setItems(res.notifications);
      setNextCursor(res.next_cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
      setItems([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await api.notifications(nextCursor);
      setItems((prev) => [...prev, ...res.notifications]);
      setNextCursor(res.next_cursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }

  async function markRead(id: string) {
    await api.markNotificationRead(id);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
  }

  async function markAllRead() {
    setBusy(true);
    setError(null);
    try {
      await api.markAllNotificationsRead();
      setItems((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark all read");
    } finally {
      setBusy(false);
    }
  }

  async function deleteOne(id: string) {
    await api.deleteNotification(id);
    setItems((prev) => prev.filter((n) => n.id !== id));
  }

  async function deleteAll() {
    if (!window.confirm("Delete all notifications? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteAllNotifications();
      setItems([]);
      setNextCursor(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete notifications");
    } finally {
      setBusy(false);
    }
  }

  const hasUnread = items.some((n) => !n.read_at);

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Notifications</h1>
        <p className="text-sm text-slate-600">
          <Link to="/" className="underline text-slate-800">
            Back to calendar
          </Link>
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || !hasUnread}
          onClick={() => void markAllRead()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          Mark all read
        </button>
        <button
          type="button"
          disabled={busy || items.length === 0}
          onClick={() => void deleteAll()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Delete all
        </button>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No notifications.</p>
        ) : (
          <ul>
            {items.map((n) => (
              <NotificationRow
                key={n.id}
                notification={n}
                onMarkRead={(id) => void markRead(id)}
                onDelete={(id) => void deleteOne(id)}
              />
            ))}
          </ul>
        )}
      </section>

      {nextCursor && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
