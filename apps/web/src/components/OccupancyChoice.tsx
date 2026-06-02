import type { OccupancyPick } from "../lib/occupancy-choice";

type Props = {
  value: OccupancyPick;
  onChange: (value: OccupancyPick) => void;
  /** e.g. "for this week" */
  scopeLabel?: string;
  compact?: boolean;
};

export function OccupancyChoice({ value, onChange, scopeLabel, compact }: Props) {
  const label = scopeLabel ? `Sharing preference ${scopeLabel}` : "Sharing preference";
  const options: { value: OccupancyPick; title: string; hint: string }[] = [
    {
      value: "green",
      title: "Green",
      hint: "Fine with others joining during your week",
    },
    {
      value: "red",
      title: "Red",
      hint: "Prefer the cabin mostly to yourselves",
    },
    {
      value: "none",
      title: "None",
      hint: "Set later (you can mark individual days on the calendar)",
    },
  ];

  return (
    <fieldset className={compact ? "text-sm" : ""}>
      <legend className="text-xs font-medium text-slate-700 mb-1.5">{label}</legend>
      <div className={`flex flex-wrap gap-2 ${compact ? "text-xs" : "text-sm"}`}>
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-1.5 rounded border px-2 py-1.5 cursor-pointer has-[:checked]:border-slate-500 has-[:checked]:bg-white ${
              opt.value === "green"
                ? "border-green-200 bg-green-50/50"
                : opt.value === "red"
                  ? "border-red-200 bg-red-50/50"
                  : "border-slate-200 bg-slate-50/50"
            }`}
          >
            <input
              type="radio"
              name={`occ-${scopeLabel ?? "pick"}`}
              className="mt-0.5"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span>
              <span className="font-medium">{opt.title}</span>
              {!compact && <span className="block text-xs text-slate-500 mt-0.5">{opt.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      {!compact && (
        <p className="text-xs text-slate-500 mt-1.5">
          Applies to the full scheduling week by default. Open any day in your week to set green/red
          for specific days only.
        </p>
      )}
    </fieldset>
  );
}
