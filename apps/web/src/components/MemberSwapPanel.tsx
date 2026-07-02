import { useCallback, useEffect, useState } from "react";
import { api, type PeriodSwapRecord } from "../lib/api";
import type { AuthUser } from "../lib/api";
import type { CalendarPeriod } from "../lib/calendar-types";
import { SwapWeeksForm } from "./SwapWeeksForm";

type Props = {
  periods: CalendarPeriod[];
  user: AuthUser;
  visibleMonthStart: string;
  visibleMonthEnd: string;
  onChanged: () => void;
  refreshToken: number;
};

function periodOverlapsMonth(
  period: CalendarPeriod,
  monthStart: string,
  monthEnd: string,
): boolean {
  if (!period.start_date || !period.end_date) return false;
  return period.start_date <= monthEnd && period.end_date >= monthStart;
}

function SwapHistory({ periodId, refreshToken }: { periodId: string; refreshToken: number }) {
  const [swaps, setSwaps] = useState<PeriodSwapRecord[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.periodSwaps(periodId);
      setSwaps(res.swaps);
    } catch {
      setSwaps([]);
    }
  }, [periodId]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  if (swaps.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-slate-700 underline hover:text-slate-900"
      >
        {open ? "Hide swap history" : `Swap history (${swaps.length})`}
      </button>
      {open && (
        <ul className="mt-2 space-y-2 max-h-48 overflow-y-auto">
          {swaps.map((s) => (
            <li
              key={s.id}
              className="text-xs text-slate-600 rounded border border-slate-100 bg-slate-50 px-2 py-1.5"
            >
              <span className="font-medium text-slate-800">
                {new Date(s.swapped_at).toLocaleString()}
              </span>
              {" · "}
              {s.actor_name}: {s.household_a} ({s.week_a_start}) ↔ {s.household_b} ({s.week_b_start})
              {s.reason && (
                <span className="block mt-0.5 text-slate-500">Reason: {s.reason}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Below-calendar swap tools for members on published periods. */
export function MemberSwapPanel({
  periods,
  user,
  visibleMonthStart,
  visibleMonthEnd,
  onChanged,
  refreshToken,
}: Props) {
  const published = periods.filter(
    (p) => p.status === "published" && periodOverlapsMonth(p, visibleMonthStart, visibleMonthEnd),
  );

  if (published.length === 0 || !user.householdId) return null;

  return (
    <div className="mb-3 sm:mb-4 space-y-3">
      {published.map((period) => (
        <div
          key={period.id}
          className="rounded-lg border border-slate-200 bg-white px-3 sm:px-4 py-3 sm:py-4 text-sm"
        >
          <p className="text-xs text-slate-500 mb-2">{period.name} — schedule set</p>
          <SwapWeeksForm
            period={period}
            user={user}
            onChanged={onChanged}
            refreshToken={refreshToken}
          />
          <SwapHistory periodId={period.id} refreshToken={refreshToken} />
        </div>
      ))}
    </div>
  );
}
