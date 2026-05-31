import { addDays, startOfWeek, toDateString } from "./dates.js";

/** Build week rows for a scheduling period (overlap-based, for materialization). */
export function computePeriodWeeks(
  periodStart: Date,
  periodEnd: Date,
  weekStartDay: number,
): { weekStartDate: Date; weekEndDate: Date; sortOrder: number }[] {
  const weeks: { weekStartDate: Date; weekEndDate: Date; sortOrder: number }[] = [];
  let cursor = startOfWeek(periodStart, weekStartDay);
  let sortOrder = 0;

  while (cursor.getTime() <= periodEnd.getTime()) {
    const weekEnd = addDays(cursor, 6);
    if (weekEnd.getTime() >= periodStart.getTime()) {
      weeks.push({
        weekStartDate: new Date(cursor),
        weekEndDate: weekEnd,
        sortOrder: sortOrder++,
      });
    }
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export { toDateString };
