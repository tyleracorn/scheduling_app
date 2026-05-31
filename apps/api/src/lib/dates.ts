/** Format Date (UTC date parts) as YYYY-MM-DD */
export function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDateString(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

/** Start of week containing `date` (0 = Sunday .. 6 = Saturday) */
export function startOfWeek(date: Date, weekStartDay: number): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day - weekStartDay + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

/** Weeks overlapping [rangeStart, rangeEnd] (inclusive civil dates) */
export function weeksOverlappingRange(
  rangeStart: Date,
  rangeEnd: Date,
  weekStartDay: number,
): { weekStart: Date; weekEnd: Date }[] {
  const weeks: { weekStart: Date; weekEnd: Date }[] = [];
  let cursor = startOfWeek(rangeStart, weekStartDay);
  const end = rangeEnd.getTime();

  while (cursor.getTime() <= end) {
    const weekEnd = addDays(cursor, 6);
    if (weekEnd.getTime() >= rangeStart.getTime()) {
      weeks.push({ weekStart: new Date(cursor), weekEnd });
    }
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function monthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return { start: toDateString(start), end: toDateString(end) };
}
