import { addDays, gapContainsWeekend, startOfWeek, startOfWeekOnOrAfter, toDateString } from "./dates.js";

/** Week ends on the same weekday as it starts (+7 days), so consecutive weeks share that handoff day. */
export const WEEK_SPAN_DAYS = 7;

export type PeriodWeekRow = {
  weekStartDate: Date;
  weekEndDate: Date;
  sortOrder: number;
  kind?: "bridge" | "merged" | "normal";
};

/** Build week rows between periodStart and periodEnd (inclusive), same-weekday boundaries. */
export function computePeriodWeeks(
  periodStart: Date,
  periodEnd: Date,
  weekStartDay: number,
): { weekStartDate: Date; weekEndDate: Date; sortOrder: number }[] {
  const aligned = startOfWeek(periodStart, weekStartDay);
  const weeks: { weekStartDate: Date; weekEndDate: Date; sortOrder: number }[] = [];
  let cursor = aligned;
  let sortOrder = 0;

  while (cursor.getTime() <= periodEnd.getTime()) {
    const weekEndDate = addDays(cursor, WEEK_SPAN_DAYS);
    if (weekEndDate.getTime() >= periodStart.getTime()) {
      weeks.push({
        weekStartDate: new Date(cursor),
        weekEndDate,
        sortOrder: sortOrder++,
      });
    }
    // periodEnd is the last week's handoff day — do not start another week on that date
    if (weekEndDate.getTime() >= periodEnd.getTime()) break;
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/** Calendar span covered by materialized weeks (first week start → last week handoff). */
export function periodBoundsFromWeeks(
  weeks: { weekStartDate: Date; weekEndDate: Date; sortOrder: number }[],
): { startDate: Date; endDate: Date } | null {
  if (weeks.length === 0) return null;
  const sorted = [...weeks].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    startDate: sorted[0]!.weekStartDate,
    endDate: sorted[sorted.length - 1]!.weekEndDate,
  };
}

/** Exactly `weekCount` consecutive weeks beginning at the week containing periodStart. */
export function computePeriodWeeksExact(
  periodStart: Date,
  weekCount: number,
  weekStartDay: number,
): PeriodWeekRow[] {
  const aligned = startOfWeek(periodStart, weekStartDay);
  const weeks: PeriodWeekRow[] = [];
  for (let i = 0; i < weekCount; i++) {
    const weekStartDate = addDays(aligned, i * 7);
    weeks.push({
      weekStartDate,
      weekEndDate: addDays(weekStartDate, WEEK_SPAN_DAYS),
      sortOrder: i,
      kind: "normal",
    });
  }
  return weeks;
}

/**
 * Build weeks for a new period continuing from `lastEnd` (previous period handoff day).
 * Bridge weekend gaps get an extra week; shorter gaps merge into week 1.
 */
export function computePeriodWeeksFromContinuation(
  lastEnd: Date,
  weekCount: number,
  weekStartDay: number,
): PeriodWeekRow[] {
  const alignedStart = startOfWeekOnOrAfter(lastEnd, weekStartDay);
  const gapMs = alignedStart.getTime() - lastEnd.getTime();

  if (gapMs === 0) {
    return computePeriodWeeksExact(lastEnd, weekCount, weekStartDay);
  }

  const weeks: PeriodWeekRow[] = [];
  let sortOrder = 0;

  if (gapContainsWeekend(lastEnd, alignedStart)) {
    weeks.push({
      weekStartDate: new Date(lastEnd),
      weekEndDate: new Date(alignedStart),
      sortOrder: sortOrder++,
      kind: "bridge",
    });
    for (const w of computePeriodWeeksExact(alignedStart, weekCount, weekStartDay)) {
      weeks.push({ ...w, sortOrder: sortOrder++, kind: "normal" });
    }
    return weeks;
  }

  const firstWeekEnd = addDays(alignedStart, WEEK_SPAN_DAYS);
  weeks.push({
    weekStartDate: new Date(lastEnd),
    weekEndDate: firstWeekEnd,
    sortOrder: sortOrder++,
    kind: "merged",
  });

  const remaining = weekCount - 1;
  if (remaining > 0) {
    for (const w of computePeriodWeeksExact(firstWeekEnd, remaining, weekStartDay)) {
      weeks.push({ ...w, sortOrder: sortOrder++, kind: "normal" });
    }
  }

  return weeks;
}

export function weekSpanDays(week: { weekStartDate: Date; weekEndDate: Date }): number {
  return Math.round((week.weekEndDate.getTime() - week.weekStartDate.getTime()) / 86400000);
}

export { toDateString };
