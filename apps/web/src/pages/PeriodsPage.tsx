import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Period } from "../lib/period-types";
import { calendarPathForPeriod, coordinatePathForPeriod } from "../lib/period-navigation";
import { useAuth } from "../context/AuthContext";
import { PeriodPlanForm } from "../components/PeriodPlanForm";
import { PeriodPriorityEditor, PeriodPriorityReadOnly } from "../components/PeriodPriorityEditor";

function statusLabel(status: string) {
  const map: Record<string, string> = {
    scheduled: "Scheduled",
    open: "Open for notes",
    draft: "Pick your weeks",
    assignment: "Assign remaining weeks",
    published: "Schedule set",
    archived: "Archived",
  };
  return map[status] ?? status;
}

function canDeletePeriod(status: string) {
  return status === "scheduled" || status === "open";
}

function canResetPeriod(status: string) {
  return status === "open" || status === "draft" || status === "assignment" || status === "published";
}

function canEditPriorities(status: string) {
  return status === "scheduled" || status === "open";
}

export function PeriodsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isCoordinator = !!(user?.isCoordinator || user?.isAdmin);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.periods();
      setPeriods(res.periods);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load periods");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadPeriod(p: Period) {
    setBusy(true);
    setError(null);
    try {
      const safeName = p.name.replace(/[^\w.-]+/g, "_");
      await api.exportPeriod(p.id, `${safeName}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  async function startDraft(id: string) {
    if (!confirm("Start the draft? Households will be notified.")) return;
    setBusy(true);
    setError(null);
    try {
      await api.startDraft(id);
      const detail = await api.period(id);
      navigate(coordinatePathForPeriod(detail.period.start_date, detail.period.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start draft failed");
    } finally {
      setBusy(false);
    }
  }

  async function removePeriod(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.deletePeriod(id);
      setMessage(`Deleted ${name}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  async function resetPeriod(id: string, name: string) {
    if (
      !confirm(
        `Reset "${name}"?\n\nThis clears all draft picks, assignments, and occupancy indicators for this period's dates, then returns it to Open so you can start the draft again. This is intended for testing.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.resetPeriod(id);
      setMessage(`Reset ${name} — period is open again with no assignments.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  function updatePeriodPriorities(periodId: string, priorities: Period["priorities"]) {
    setPeriods((prev) =>
      prev.map((p) => (p.id === periodId ? { ...p, priorities } : p)),
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Scheduling periods</h1>
        <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
          ← Calendar
        </Link>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 text-sm text-green-700" role="status">
          {message}
        </p>
      )}

      {isCoordinator && (
        <PeriodPlanForm
          onMessage={setMessage}
          onError={setError}
          onPeriodsGenerated={() => void load()}
        />
      )}

      <h2 className="font-medium text-slate-800 mb-3">All periods</h2>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : periods.length === 0 ? (
        <p className="text-slate-500">
          No periods yet. Coordinators can configure the period plan above and generate periods.
        </p>
      ) : (
        <ul className="space-y-4">
          {periods.map((p) => (
            <li key={p.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{p.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {p.start_date} – {p.end_date} · {statusLabel(p.status)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={calendarPathForPeriod(p.start_date)}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Open on calendar
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void downloadPeriod(p)}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    Download CSV
                  </button>
                  {isCoordinator && p.status === "open" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void startDraft(p.id)}
                      className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Start draft
                    </button>
                  )}
                  {(p.status === "draft" || p.status === "assignment") && (
                    <Link
                      to={coordinatePathForPeriod(p.start_date, p.id)}
                      className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                    >
                      {p.status === "draft" ? "Pick weeks →" : "Assign weeks →"}
                    </Link>
                  )}
                  {isCoordinator && canResetPeriod(p.status) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void resetPeriod(p.id, p.name)}
                      className="rounded border border-amber-400 px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                    >
                      Reset period
                    </button>
                  )}
                  {isCoordinator && canDeletePeriod(p.status) && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removePeriod(p.id, p.name)}
                      className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {isCoordinator && canEditPriorities(p.status) && p.priorities && (
                <PeriodPriorityEditor
                  periodId={p.id}
                  priorities={p.priorities}
                  disabled={busy}
                  onUpdated={(priorities) => updatePeriodPriorities(p.id, priorities)}
                  onError={setError}
                  onMessage={setMessage}
                />
              )}
              {!canEditPriorities(p.status) && p.priorities && (
                <PeriodPriorityReadOnly priorities={p.priorities} />
              )}
              {p.weeks && (
                <p className="text-xs text-slate-500 mt-2">{p.weeks.length} weeks</p>
              )}
              {p.status === "draft" && (
                <p className="text-xs text-indigo-700 mt-2">
                  Use the indigo <strong>Draft</strong> panel on the calendar to pick or skip.
                </p>
              )}
              {p.status === "assignment" && (
                <p className="text-xs text-emerald-700 mt-2">
                  Click unassigned weeks on the calendar to assign, then publish from the assignment panel.
                </p>
              )}
              {isCoordinator && canResetPeriod(p.status) && p.status !== "open" && (
                <p className="text-xs text-amber-800 mt-2">
                  <strong>Reset period</strong> clears all picks and assignments for testing (returns to Open).
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
