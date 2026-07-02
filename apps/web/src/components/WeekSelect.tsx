type WeekOption = {
  period_week_id: string;
  week_start_date: string;
  week_end_date: string;
  period_name?: string;
};

type Props = {
  weeks: WeekOption[];
  value: string;
  onChange: (weekId: string) => void;
  label?: string;
  hint?: string;
  emptyLabel?: string;
  className?: string;
  selectClassName?: string;
};

export function WeekSelect({
  weeks,
  value,
  onChange,
  label = "Pick a week",
  hint,
  emptyLabel = "Select week…",
  className = "flex flex-col gap-1",
  selectClassName = "rounded border border-indigo-300 bg-white px-2 py-1.5 min-w-[12rem]",
}: Props) {
  if (weeks.length === 0) return null;

  return (
    <label className={className}>
      <span className="text-xs font-medium">{label}</span>
      {hint && <span className="text-xs font-normal text-indigo-700">{hint}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClassName}>
        <option value="">{emptyLabel}</option>
        {weeks.map((w) => (
          <option key={w.period_week_id} value={w.period_week_id}>
            {w.week_start_date} – {w.week_end_date}
            {w.period_name ? ` (${w.period_name})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
