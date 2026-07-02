/** Pick the scheduling week that matches the clicked calendar week, or the first option. */
export function preferredSchedulingWeekId(
  clickedWeek: { period_week_id: string } | null | undefined,
  options: { period_week_id: string }[],
): string {
  if (!options.length) {
    return clickedWeek?.period_week_id ?? "";
  }
  if (clickedWeek && options.some((w) => w.period_week_id === clickedWeek.period_week_id)) {
    return clickedWeek.period_week_id;
  }
  return options[0]?.period_week_id ?? clickedWeek?.period_week_id ?? "";
}
