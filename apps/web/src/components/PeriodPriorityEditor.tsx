import { useEffect, useState } from "react";
import { api } from "../lib/api";
import type { PeriodPriority } from "../lib/period-types";

type PeriodPriorityEditorProps = {
  periodId: string;
  priorities: PeriodPriority[];
  disabled?: boolean;
  onUpdated: (priorities: PeriodPriority[]) => void;
  onError?: (message: string | null) => void;
  onMessage?: (message: string | null) => void;
};

function sortedPriorities(priorities: PeriodPriority[]): PeriodPriority[] {
  return [...priorities].sort((a, b) => a.position - b.position);
}

export function PeriodPriorityEditor({
  periodId,
  priorities,
  disabled = false,
  onUpdated,
  onError,
  onMessage,
}: PeriodPriorityEditorProps) {
  const [order, setOrder] = useState<PeriodPriority[]>(() => sortedPriorities(priorities));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOrder(sortedPriorities(priorities));
  }, [priorities]);

  function move(index: number, direction: -1 | 1) {
    const next = [...order];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const tmp = next[index]!;
    next[index] = next[target]!;
    next[target] = tmp;
    setOrder(next);
  }

  const isDirty =
    order.length !== priorities.length ||
    order.some((p, i) => p.household_id !== sortedPriorities(priorities)[i]?.household_id);

  async function save() {
    setBusy(true);
    onError?.(null);
    onMessage?.(null);
    try {
      const payload = order.map((p, i) => ({
        household_id: p.household_id,
        position: i + 1,
      }));
      const { period } = await api.setPeriodPriorities(periodId, payload);
      onUpdated(period.priorities ?? []);
      onMessage?.("Draft order saved.");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    onError?.(null);
    onMessage?.(null);
    try {
      const { period } = await api.resetPeriodPriorities(periodId);
      onUpdated(period.priorities ?? []);
      onMessage?.("Draft order reset to rotated default.");
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  if (order.length === 0) {
    return <p className="text-xs text-slate-500 mt-2">No households in draft order.</p>;
  }

  const isDisabled = disabled || busy;

  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-700 mb-1">Draft pick order</p>
      <p className="text-xs text-slate-500 mb-2">
        Default order rotates each period — whoever was last moves to first.
      </p>
      <ol className="space-y-1">
        {order.map((p, index) => (
          <li
            key={p.household_id}
            className="flex items-center justify-between gap-2 rounded bg-white border border-slate-200 px-2 py-1.5 text-sm"
          >
            <span>
              <span className="text-slate-400 mr-2">{index + 1}.</span>
              {p.household_name}
            </span>
            <span className="flex gap-1 shrink-0">
              <button
                type="button"
                disabled={isDisabled || index === 0}
                onClick={() => move(index, -1)}
                className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50 disabled:opacity-40"
                aria-label={`Move ${p.household_name} up`}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={isDisabled || index === order.length - 1}
                onClick={() => move(index, 1)}
                className="rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50 disabled:opacity-40"
                aria-label={`Move ${p.household_name} down`}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          disabled={isDisabled || !isDirty}
          onClick={() => void save()}
          className="rounded bg-slate-800 px-3 py-1.5 text-xs text-white hover:bg-slate-900 disabled:opacity-50"
        >
          Save order
        </button>
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => void reset()}
          className="rounded border border-slate-400 px-3 py-1.5 text-xs hover:bg-white disabled:opacity-50"
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}

export function PeriodPriorityReadOnly({ priorities }: { priorities: PeriodPriority[] }) {
  if (priorities.length === 0) return null;
  return (
    <p className="text-xs text-slate-500 mt-2">
      Draft order:{" "}
      {sortedPriorities(priorities)
        .map((x) => x.household_name)
        .join(" → ")}
    </p>
  );
}
