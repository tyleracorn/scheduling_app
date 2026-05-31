import type { CalendarWeek } from "./calendar-types";

export function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function buildMonthGrid(year: number, month: number, weekStartDay: number): (Date | null)[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  const startPad = (first.getUTCDay() - weekStartDay + 7) % 7;
  const days: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= last.getUTCDate(); d++) {
    days.push(new Date(Date.UTC(year, month, d)));
  }
  while (days.length % 7 !== 0) days.push(null);
  const rows: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }
  return rows;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayHeaders(weekStartDay: number): string[] {
  return Array.from({ length: 7 }, (_, i) => WEEKDAY_LABELS[(weekStartDay + i) % 7]);
}

export function assignmentForDay(
  date: Date,
  weeks: CalendarWeek[],
): { week: CalendarWeek; assignment: NonNullable<CalendarWeek["assignment"]> } | null {
  const key = date.toISOString().slice(0, 10);
  for (const week of weeks) {
    if (key >= week.week_start_date && key <= week.week_end_date && week.assignment) {
      return { week, assignment: week.assignment };
    }
  }
  return null;
}

export function weekForDay(date: Date, weeks: CalendarWeek[]): CalendarWeek | null {
  const key = date.toISOString().slice(0, 10);
  return weeks.find((w) => key >= w.week_start_date && key <= w.week_end_date) ?? null;
}

export function formatPeriodStatus(status: string): string {
  const labels: Record<string, string> = {
    scheduled: "Scheduled",
    open: "Open for notes",
    draft: "Draft in progress",
    assignment: "Coordinator assigning weeks",
    published: "Published",
    archived: "Archived",
  };
  return labels[status] ?? status;
}
