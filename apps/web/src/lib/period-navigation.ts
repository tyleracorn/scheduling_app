/** UTC month index (0–11) and year for linking to the calendar from a period start date. */
export function calendarMonthFromStartDate(startDate: string): { year: number; month: number } {
  const [y, m] = startDate.split("-").map(Number);
  return { year: y, month: m - 1 };
}

export function calendarPathForPeriod(startDate: string): string {
  const { year, month } = calendarMonthFromStartDate(startDate);
  return `/?year=${year}&month=${month}`;
}

export function coordinatePathForPeriod(startDate: string, periodId?: string): string {
  const { year, month } = calendarMonthFromStartDate(startDate);
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  if (periodId) params.set("period", periodId);
  return `/coordinate?${params.toString()}`;
}
