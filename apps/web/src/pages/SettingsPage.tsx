import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { SystemSettings } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  getOccupancyDefaultMode,
  getOccupancyDisplayStrength,
  setOccupancyDefaultMode,
  setOccupancyDisplayStrength,
  type OccupancyDefaultMode,
  type OccupancyDisplayStrength,
} from "../lib/preferences";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function SettingsPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<OccupancyDefaultMode>(() => getOccupancyDefaultMode());
  const [displayStrength, setDisplayStrength] = useState<OccupancyDisplayStrength>(() =>
    getOccupancyDisplayStrength(),
  );
  const [saved, setSaved] = useState(false);
  const [displaySaved, setDisplaySaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isCoordinator = !!(user?.isCoordinator || user?.isAdmin);
  const isAdmin = !!user?.isAdmin;

  const [systemForm, setSystemForm] = useState<SystemSettings>({
    week_selections_per_household: 1,
    pick_window_days: 3,
    pick_warning_lead_days: 1,
    history_retention_years: 3,
  });

  const [planForm, setPlanForm] = useState({
    first_week_start: "",
    weeks_per_period: 13,
    rounds_per_household: 1,
    periods_to_schedule: 4,
    week_start_day: 0,
  });
  const [replaceUnstarted, setReplaceUnstarted] = useState(false);

  const load = useCallback(async () => {
    if (!isCoordinator) return;
    setError(null);
    try {
      const [{ settings }, { plan }] = await Promise.all([
        api.systemSettings(),
        api.periodPlan(),
      ]);
      setSystemForm(settings);
      setPlanForm({
        first_week_start: plan.first_week_start ?? "",
        weeks_per_period: plan.weeks_per_period,
        rounds_per_household: plan.rounds_per_household,
        periods_to_schedule: plan.periods_to_schedule,
        week_start_day: plan.week_start_day,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    }
  }, [isCoordinator]);

  useEffect(() => {
    void load();
  }, [load]);

  function selectOccupancy(next: OccupancyDefaultMode) {
    setMode(next);
    setOccupancyDefaultMode(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  function selectDisplayStrength(next: OccupancyDisplayStrength) {
    setDisplayStrength(next);
    setOccupancyDisplayStrength(next);
    setDisplaySaved(true);
    window.setTimeout(() => setDisplaySaved(false), 2000);
  }

  async function saveSystemSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.updateSystemSettings(systemForm);
      setSystemForm(res.settings);
      setMessage("System settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

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
      !confirm("Remove all scheduled and open periods, then create a fresh set from the plan?")
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.savePeriodPlan(planForm);
      const result = await api.generatePeriods(replaceUnstarted);
      const parts = [`Created ${result.created.length} of ${planForm.periods_to_schedule} period(s).`];
      if (result.skipped.length > 0) {
        parts.push(`Skipped ${result.skipped.length}: ${result.skipped.join("; ")}`);
      }
      setMessage(parts.join(" "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Settings</h1>
        <p className="text-sm text-slate-600">
          <Link to="/" className="underline text-slate-800">
            Back to calendar
          </Link>
          {isCoordinator && (
            <>
              {" "}
              ·{" "}
              <Link to="/periods" className="underline text-slate-800">
                Periods
              </Link>
            </>
          )}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-green-700" role="status">
          {message}
        </p>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-slate-800 mb-1">Occupancy default</h2>
        <p className="text-xs text-slate-500 mb-4">
          Saved in this browser. Pre-fills the green/red choice when you pick, assign, or swap weeks.
          You can change it each time, set none, or mark individual days later on the calendar.
        </p>
        <div className="space-y-3">
          {(["green", "red", "none"] as const).map((value) => (
            <label
              key={value}
              className="flex items-start gap-3 cursor-pointer rounded-md border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-slate-400"
            >
              <input
                type="radio"
                name="occ-mode"
                className="mt-0.5"
                checked={mode === value}
                onChange={() => selectOccupancy(value)}
              />
              <span>
                <span className="font-medium text-slate-800">
                  {value === "green" ? "Green (default)" : value === "red" ? "Red (default)" : "Don't assign default"}
                </span>
              </span>
            </label>
          ))}
        </div>
        {saved && <p className="text-sm text-green-700 mt-4">Saved.</p>}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-slate-800 mb-1">Occupancy on calendar</h2>
        <p className="text-xs text-slate-500 mb-4">
          How strongly green/red occupancy shows on day cells. Saved in this browser only. When
          multiple households overlap on a handoff day, each gets a small labeled marker.
        </p>
        <div className="space-y-3">
          {(
            [
              ["subtle", "Subtle", "Thin outline; tiny dots when several households overlap."],
              ["standard", "Standard", "Colored outline + tint; household initial on each marker."],
              ["strong", "Strong", "Bold outline and background; easiest to scan at a glance."],
            ] as const
          ).map(([value, title, desc]) => (
            <label
              key={value}
              className="flex items-start gap-3 cursor-pointer rounded-md border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-slate-400"
            >
              <input
                type="radio"
                name="occ-display"
                className="mt-0.5"
                checked={displayStrength === value}
                onChange={() => selectDisplayStrength(value)}
              />
              <span>
                <span className="font-medium text-slate-800">{title}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{desc}</span>
              </span>
            </label>
          ))}
        </div>
        {displaySaved && <p className="text-sm text-green-700 mt-4">Saved.</p>}
      </section>

      {isCoordinator && (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-medium text-slate-800 mb-1">System settings</h2>
            <p className="text-xs text-slate-500 mb-4">
              {isAdmin ? "Admin can edit." : "Read-only — contact an admin to change."}
            </p>
            <form onSubmit={(e) => void saveSystemSettings(e)} className="space-y-3">
              <label className="block text-sm">
                Pick window (days)
                <span className="block text-xs font-normal text-slate-500 mt-0.5 mb-1">
                  How long each household has to pick or skip when it is their turn in the draft.
                  After this many days the turn auto-skips.
                </span>
                <input
                  type="number"
                  min={1}
                  max={14}
                  disabled={!isAdmin || busy}
                  value={systemForm.pick_window_days}
                  onChange={(e) =>
                    setSystemForm((f) => ({
                      ...f,
                      pick_window_days: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white disabled:bg-slate-50"
                />
              </label>
              <label className="block text-sm">
                Pick warning lead (days)
                <span className="block text-xs font-normal text-slate-500 mt-0.5 mb-1">
                  How many days before a turn deadline to send a reminder (when email warnings are
                  enabled). Use 0 to disable lead-time warnings.
                </span>
                <input
                  type="number"
                  min={0}
                  max={7}
                  disabled={!isAdmin || busy}
                  value={systemForm.pick_warning_lead_days}
                  onChange={(e) =>
                    setSystemForm((f) => ({
                      ...f,
                      pick_warning_lead_days: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white disabled:bg-slate-50"
                />
              </label>
              <label className="block text-sm">
                History retention (years)
                <input
                  type="number"
                  min={1}
                  max={20}
                  disabled={!isAdmin || busy}
                  value={systemForm.history_retention_years}
                  onChange={(e) =>
                    setSystemForm((f) => ({
                      ...f,
                      history_retention_years: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white disabled:bg-slate-50"
                />
              </label>
              {isAdmin && (
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  Save system settings
                </button>
              )}
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-sm font-medium text-slate-800 mb-1">Period plan</h2>
            <p className="text-xs text-slate-500 mb-4">
              Configure how future scheduling periods are generated. The plan grid is anchored from
              first period start + week start day — changing <strong>week starts on</strong> realigns
              that grid even if the calendar date stays the same. Generation never overlaps
              published or in-progress periods; it skips forward on the grid until free slots are
              found. New periods open immediately for notes. Manage periods on{" "}
              <Link to="/periods" className="underline">
                Periods
              </Link>
              . If fewer periods are created than requested, read the skip message (delete
              overlapping scheduled/open periods or use Replace unstarted).
            </p>
            <form onSubmit={(e) => void savePlan(e)} className="space-y-3">
              <label className="block text-sm">
                Week starts on
                <span className="block text-xs font-normal text-slate-500 mt-0.5 mb-1">
                  Shifts how weeks are cut from the first start date. Does not move existing
                  published periods — regenerate only fills free slots after them.
                </span>
                <select
                  value={planForm.week_start_day}
                  onChange={(e) =>
                    setPlanForm((f) => ({ ...f, week_start_day: parseInt(e.target.value, 10) }))
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
                  onChange={(e) => setPlanForm((f) => ({ ...f, first_week_start: e.target.value }))}
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
                Draft rounds per household
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
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={replaceUnstarted}
                  onChange={(e) => setReplaceUnstarted(e.target.checked)}
                />
                <span>
                  Replace all scheduled/open periods before generating (recommended when
                  regenerating a full set of {planForm.periods_to_schedule})
                </span>
              </label>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
