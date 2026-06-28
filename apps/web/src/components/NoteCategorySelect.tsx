import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { textColorForBackground } from "../lib/calendar-utils";

export type NoteCategoryOption = {
  id: string;
  name: string;
  slug: string;
  color: string;
  sort_order: number;
};

type Props = {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function NoteCategorySelect({ value, onChange, disabled, compact }: Props) {
  const [categories, setCategories] = useState<NoteCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .noteCategories()
      .then((res) => {
        if (!cancelled) setCategories(res.categories);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = categories.find((c) => c.id === value);

  return (
    <label className={`block ${compact ? "text-xs" : "text-sm"} text-slate-600`}>
      Category
      <div className="mt-1 flex items-center gap-2">
        {selected && (
          <span
            className="w-3 h-3 rounded-full shrink-0 border border-black/10"
            style={{ backgroundColor: selected.color }}
            title={selected.name}
            aria-hidden
          />
        )}
        <select
          value={value ?? ""}
          disabled={disabled || loading}
          onChange={(e) => onChange(e.target.value ? e.target.value : null)}
          className={`rounded border border-slate-300 bg-white ${
            compact ? "px-2 py-1 text-xs min-w-[8rem]" : "px-2 py-1.5 text-sm w-full"
          }`}
        >
          <option value="">General</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {selected && !compact && (
          <span
            className="text-xs px-1.5 py-0.5 rounded shrink-0"
            style={{
              backgroundColor: selected.color,
              color: textColorForBackground(selected.color),
            }}
          >
            {selected.name}
          </span>
        )}
      </div>
    </label>
  );
}
