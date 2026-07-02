import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { PeriodPlanPreview } from "../lib/period-types";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const WEEK_KIND_LABELS: Record<"bridge" | "merged" | "normal", string> = {
  bridge: "Bridge week",
  merged: "Merged first week",
  normal: "Week",
};

type PeriodPlanFormProps = {
  defaultOpen?: boolean;
  onMessage?: (message: string | null) => void;
  onError?: (error: string | null) => void;
  onPeriodsGenerated?: () => void;
};

export function PeriodPlanForm({
  defaultOpen = true,
  onMessage,
  onError,
  onPeriodsGenerated,
}: PeriodPlanFormProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const [planForm, setPlanForm] = useState({
    first_week_start: "",
    weeks_per_period: 13,
    rounds_per_household: 1,
    periods_to_schedule: 4,
    week_start_day: 0,
    draft_start_lead_days: 0,
  });
  const [planContext, setPlanContext] = useState({
    generation_mode: "grid" as "incremental" | "grid",
    last_period_end: null as string | null,
    next_period_start: null as string | null,
    has_blocking_periods: false,
  });
  const [gridMode, setGridMode] = useState(false);
  const [replaceUnstarted, setReplaceUnstarted] = useState(false);
  const [planPreview, setPlanPreview] = useState<PeriodPlanPreview | null>(null);

  const effectiveMode: "incremental" | "grid" =
    gridMode || !planContext.has_blocking_periods ? "grid" : "incremental";

  const load = useCallback(async () => {
    onError?.(null);
    try {
      const { plan } = await api.periodPlan();
      setPlanForm({
        first_week_start: plan.first_week_start ?? "",
        weeks_per_period: plan.weeks_per_period,
        rounds_per_household: plan.rounds_per_household,
        periods_to_schedule: plan.periods_to_schedule,
        week_start_day: plan.week_start_day,
        draft_start_lead_days: plan.draft_start_lead_days,
      });
      setPlanContext({
        generation_mode: plan.generation_mode,
        last_period_end: plan.last_period_end,
        next_period_start: plan.next_period_start,
        has_blocking_periods: plan.has_blocking_periods,
      });
      setGridMode(plan.has_blocking_periods ? false : true);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Failed to load period plan");
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePlan(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError?.(null);
    onMessage?.(null);
    try {
      await api.savePeriodPlan(planForm);
      await load();
      onMessage?.("Period plan saved.");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function previewPeriods() {
    setBusy(true);
    onError?.(null);
    onMessage?.(null);
    try {
      await api.savePeriodPlan(planForm);
      const preview = await api.previewPeriodPlan(effectiveMode);
      setPlanPreview(preview);
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Preview failed");
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
    onError?.(null);
    onMessage?.(null);
    try {
      await api.savePeriodPlan(planForm);
      const result = await api.generatePeriods({
        replace_unstarted: replaceUnstarted,
        generation_mode: effectiveMode,
      });
      onMessage?.(`Created ${result.created.length} of ${planForm.periods_to_schedule} period(s).`);
      setPlanPreview(null);
      onPeriodsGenerated?.();
      await load();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  const showAnchorDate = effectiveMode === "grid" || !planContext.has_blocking_periods;

  return (
    <section className="mb-8 rounded-lg border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span>
          <span className="block text-sm font-medium text-slate-800">Period plan</span>
          <span className="block text-xs text-slate-500 mt-0.5">
            Configure how future scheduling periods are generated
          </span>
        </span>
        <span className="text-slate-400 text-sm shrink-0">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-slate-200">
          <p className="text-xs text-slate-500 my-4">
            {effectiveMode === "incremental"
              ? "New periods continue from where the last one ended. Preview before generating — collisions with future periods will block creation."
              : "Periods are placed on a fixed grid from the anchor date. Misaligned anchors will error instead of skipping slots."}
          </p>
          <form onSubmit={(e) => void savePlan(e)} className="space-y-3">
            {planContext.has_blocking_periods && (
              <div className="rounded border border-slate-200 bg-white p-3 text-sm space-y-1">
                {planContext.last_period_end && (
                  <p className="text-slate-700">
                    <span className="font-medium">Last period ended:</span> {planContext.last_period_end}
                  </p>
                )}
                {effectiveMode === "incremental" && planContext.next_period_start && (
                  <p className="text-slate-700">
                    <span className="font-medium">Next period starts:</span>{" "}
                    {planContext.next_period_start}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  Mode: {effectiveMode === "incremental" ? "Continue after last period" : "Grid from anchor"}
                </p>
              </div>
            )}

            {planContext.has_blocking_periods && (
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={gridMode}
                  onChange={(e) => {
                    setGridMode(e.target.checked);
                    setPlanPreview(null);
                  }}
                />
                <span>
                  Replan from anchor date (advanced). Use with Replace unstarted when regenerating a
                  full set.
                </span>
              </label>
            )}

            <label className="block text-sm">
              Week starts on
              <span className="block text-xs font-normal text-slate-500 mt-0.5 mb-1">
                {effectiveMode === "incremental"
                  ? "Changing this may create a bridge or merged first week when continuing after the last period."
                  : "Shifts how weeks are cut from the anchor date."}
              </span>
              <select
                value={planForm.week_start_day}
                onChange={(e) => {
                  setPlanForm((f) => ({ ...f, week_start_day: parseInt(e.target.value, 10) }));
                  setPlanPreview(null);
                }}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
              >
                {WEEKDAY_NAMES.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            {showAnchorDate && (
              <label className="block text-sm">
                First period starts (week containing this date)
                <input
                  type="date"
                  required
                  value={planForm.first_week_start}
                  onChange={(e) => {
                    setPlanForm((f) => ({ ...f, first_week_start: e.target.value }));
                    setPlanPreview(null);
                  }}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
                />
              </label>
            )}

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
              Auto-start draft (days before period start)
              <span className="block text-xs font-normal text-slate-500 mt-0.5 mb-1">
                Draft begins this many days before the period start date. Use 0 to require manual
                start.
              </span>
              <input
                type="number"
                min={0}
                max={365}
                required
                value={planForm.draft_start_lead_days}
                onChange={(e) =>
                  setPlanForm((f) => ({
                    ...f,
                    draft_start_lead_days: parseInt(e.target.value, 10) || 0,
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
                onClick={() => void previewPeriods()}
                className="rounded border border-slate-400 px-3 py-1.5 text-sm hover:bg-white disabled:opacity-50"
              >
                Preview weeks
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
            {planPreview && (
              <div className="mt-3 rounded border border-slate-200 bg-white p-3 text-sm">
                {planPreview.error ? (
                  <p className="text-red-800 font-medium mb-2">{planPreview.error}</p>
                ) : (
                  <p className="font-medium text-slate-800 mb-2">
                    Preview ({planPreview.generation_mode}): {planPreview.would_create} of{" "}
                    {planPreview.requested} period(s) would be created
                  </p>
                )}
                <ul className="space-y-2 text-xs text-slate-600">
                  {planPreview.periods.map((p) => (
                    <li key={`${p.start_date}-${p.name}`}>
                      <p className="font-medium text-slate-700">
                        {p.name}: {p.start_date} – {p.end_date} ({p.week_count} weeks)
                      </p>
                      <ul className="mt-1 ml-3 space-y-0.5">
                        {p.weeks.map((w) => (
                          <li key={`${w.start_date}-${w.kind}`}>
                            {WEEK_KIND_LABELS[w.kind]} {w.start_date} – {w.end_date} ({w.span_days}{" "}
                            days)
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(gridMode || !planContext.has_blocking_periods) && (
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={replaceUnstarted}
                  onChange={(e) => setReplaceUnstarted(e.target.checked)}
                />
                <span>
                  Replace all scheduled/open periods before generating (required when replanning
                  from anchor over existing unstarted periods)
                </span>
              </label>
            )}
          </form>
        </div>
      )}
    </section>
  );
}
