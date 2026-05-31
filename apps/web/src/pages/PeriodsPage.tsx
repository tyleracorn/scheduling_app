import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Period } from "../lib/period-types";
import { calendarPathForPeriod } from "../lib/period-navigation";
import { useAuth } from "../context/AuthContext";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function statusLabel(status: string) {
  const map: Record<string, string> = {
    scheduled: "Scheduled",
    open: "Open",
    draft: "Draft",
    assignment: "Assignment",
    published: "Published",
    archived: "Archived",
  };
  return map[status] ?? status;
}

function canDeletePeriod(status: string) {
  return status === "scheduled" || status === "open";
}

export function PeriodsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [planForm, setPlanForm] = useState({
    first_week_start: "",
    weeks_per_period: 13,
    open_lead_days: 30,
    rounds_per_household: 1,
    periods_to_schedule: 4,
    week_start_day: 0,
  });
  const [replaceUnstarted, setReplaceUnstarted] = useState(false);
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
      if (isCoordinator) {
        const { plan: p } = await api.periodPlan();
        setPlanForm({
          first_week_start: p.first_week_start ?? "",
          weeks_per_period: p.weeks_per_period,
          open_lead_days: p.open_lead_days,
          rounds_per_household: p.rounds_per_household,
          periods_to_schedule: p.periods_to_schedule,
          week_start_day: p.week_start_day,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load periods");
    } finally {
      setLoading(false);
    }
  }, [isCoordinator]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.savePeriodPlan(planForm);
      setMessage("Period plan saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function generatePeriods() {
    if (
      replaceUnstarted &&
      !confirm(
        "Remove all scheduled and open periods, then create a fresh set from the plan?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.savePeriodPlan(planForm);
      const result = await api.generatePeriods(replaceUnstarted);
      const parts = [`Created ${result.created.length} period(s).`];
      if (result.skipped.length > 0) {
        parts.push(`Skipped ${result.skipped.length} (overlap).`);
      }
      setMessage(parts.join(" "));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
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
      navigate(calendarPathForPeriod(detail.period.start_date));
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
        <section className="mb-8 rounded-lg border border-slate-200 bg-slate-50 p-4 max-w-xl">
          <h2 className="font-medium text-lg mb-1">Period setup</h2>
          <p className="text-sm text-slate-600 mb-4">
            Each week runs from your chosen start weekday through the same weekday the following week
            (e.g. Friday–Friday). That handoff day can appear on two consecutive weeks so one household
            leaves and the next arrives — check-in times stay outside this app.
          </p>
          <form onSubmit={(e) => void savePlan(e)} className="space-y-3">
            <label className="block text-sm">
              Week starts on
              <select
                value={planForm.week_start_day}
                onChange={(e) =>
                  setPlanForm((f) => ({
                    ...f,
                    week_start_day: parseInt(e.target.value, 10),
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
              >
                {WEEKDAY_NAMES.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              First period starts (week containing this date)
              <input
                type="date"
                required
                value={planForm.first_week_start}
                onChange={(e) =>
                  setPlanForm((f) => ({ ...f, first_week_start: e.target.value }))
                }
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
              />
            </label>
            <label className="block text-sm">
              Weeks per period
              <input
                type="number"
                min={1}
                max={52}
                required
                value={planForm.weeks_per_period}
                onChange={(e) =>
                  setPlanForm((f) => ({
                    ...f,
                    weeks_per_period: parseInt(e.target.value, 10) || 1,
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
              />
            </label>
            <label className="block text-sm">
              Open for notes (days before period start)
              <input
                type="number"
                min={0}
                max={365}
                required
                value={planForm.open_lead_days}
                onChange={(e) =>
                  setPlanForm((f) => ({
                    ...f,
                    open_lead_days: parseInt(e.target.value, 10) || 0,
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
              />
            </label>
            <label className="block text-sm">
              Draft rounds per household
              <span className="block text-xs text-slate-500 font-normal">
                1 round = each household picks one week per round
              </span>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={planForm.rounds_per_household}
                onChange={(e) =>
                  setPlanForm((f) => ({
                    ...f,
                    rounds_per_household: parseInt(e.target.value, 10) || 1,
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
              />
            </label>
            <label className="block text-sm">
              Periods to auto-create
              <input
                type="number"
                min={1}
                max={12}
                required
                value={planForm.periods_to_schedule}
                onChange={(e) =>
                  setPlanForm((f) => ({
                    ...f,
                    periods_to_schedule: parseInt(e.target.value, 10) || 1,
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="rounded border border-slate-400 px-3 py-1.5 text-sm hover:bg-white disabled:opacity-50"
              >
                Save plan
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void generatePeriods()}
                className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-50"
              >
                Generate periods
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={replaceUnstarted}
                onChange={(e) => setReplaceUnstarted(e.target.checked)}
              />
              Replace all scheduled/open periods before generating
            </label>
          </form>
        </section>
      )}

      <h2 className="font-medium text-slate-800 mb-3">All periods</h2>

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : periods.length === 0 ? (
        <p className="text-slate-500">
          No periods yet. Coordinators can save a plan and generate periods above.
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
                  {p.priorities && p.priorities.length > 0 && (
                    <p className="text-xs text-slate-500 mt-2">
                      Priority:{" "}
                      {p.priorities
                        .slice()
                        .sort((a, b) => a.position - b.position)
                        .map((x) => x.household_name)
                        .join(" → ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={calendarPathForPeriod(p.start_date)}
                    className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    Open on calendar
                  </Link>
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
                      to={calendarPathForPeriod(p.start_date)}
                      className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                    >
                      Pick weeks on calendar →
                    </Link>
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
              {p.weeks && (
                <p className="text-xs text-slate-500 mt-2">
                  {p.weeks.length} weeks · opens before start per plan
                </p>
              )}
              {p.status === "draft" && (
                <p className="text-xs text-indigo-700 mt-2">
                  Use the indigo <strong>Draft</strong> panel on the calendar to pick or skip.
                </p>
              )}
              {isCoordinator && !canDeletePeriod(p.status) && (
                <p className="text-xs text-slate-400 mt-2">
                  In progress or published — cannot delete (keeps history).
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
