import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  });
  const [replaceUnstarted, setReplaceUnstarted] = useState(false);
  const [planPreview, setPlanPreview] = useState<
    Awaited<ReturnType<typeof api.previewPeriodPlan>> | null
  >(null);

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
      });
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
      const preview = await api.previewPeriodPlan();
      setPlanPreview(preview);
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
      const result = await api.generatePeriods(replaceUnstarted);
      const parts = [`Created ${result.created.length} of ${planForm.periods_to_schedule} period(s).`];
      if (result.skipped.length > 0) {
        parts.push(`Skipped ${result.skipped.length}: ${result.skipped.join("; ")}`);
      }
      onMessage?.(parts.join(" "));
      onPeriodsGenerated?.();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

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
            The plan grid is anchored from first period start + week start day. Generation never
            overlaps published or in-progress periods. New periods open immediately for notes. If
            fewer periods are created than requested, read the skip message or use Replace
            unstarted.
          </p>
          <form onSubmit={(e) => void savePlan(e)} className="space-y-3">
            <label className="block text-sm">
              Week starts on
              <span className="block text-xs font-normal text-slate-500 mt-0.5 mb-1">
                Shifts how weeks are cut from the first start date.
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
                <p className="font-medium text-slate-800 mb-2">
                  Preview: {planPreview.would_create} of {planPreview.requested} period(s) would be
                  created
                </p>
                <ul className="space-y-1 text-xs text-slate-600">
                  {planPreview.periods.map((p) => (
                    <li key={`${p.start_date}-${p.name}`}>
                      {p.skipped ? (
                        <span className="text-amber-800">
                          Skip {p.start_date} – {p.end_date} ({p.skip_reason})
                        </span>
                      ) : (
                        <span>
                          {p.name}: {p.start_date} – {p.end_date} ({p.week_count} weeks)
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={replaceUnstarted}
                onChange={(e) => setReplaceUnstarted(e.target.checked)}
              />
              <span>
                Replace all scheduled/open periods before generating (recommended when regenerating
                a full set of {planForm.periods_to_schedule})
              </span>
            </label>
          </form>
        </div>
      )}
    </section>
  );
}
