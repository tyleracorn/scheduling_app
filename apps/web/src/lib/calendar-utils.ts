import type { CalendarNote, CalendarWeek, OccupancyIndicator } from "./calendar-types";

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

const ACTIVE_PERIOD_STATUSES = new Set(["draft", "open", "assignment", "scheduled"]);

function weeksCoveringDay(date: Date, weeks: CalendarWeek[]): CalendarWeek[] {
  const key = date.toISOString().slice(0, 10);
  return weeks.filter((w) => key >= w.week_start_date && key <= w.week_end_date);
}

/** Prefer in-progress periods over published so draft weeks stay empty until picked. */
function prioritizeWeeksForDay(date: Date, covering: CalendarWeek[]): CalendarWeek[] {
  const key = date.toISOString().slice(0, 10);
  const active = covering.filter((w) => ACTIVE_PERIOD_STATUSES.has(w.period_status));
  const pool = active.length > 0 ? active : covering;
  return [...pool].sort((a, b) => {
    if (a.week_start_date === key && b.week_start_date !== key) return -1;
    if (b.week_start_date === key && a.week_start_date !== key) return 1;
    return a.week_start_date.localeCompare(b.week_start_date);
  });
}

export function assignmentForDay(
  date: Date,
  weeks: CalendarWeek[],
): { week: CalendarWeek; assignment: NonNullable<CalendarWeek["assignment"]> } | null {
  for (const week of prioritizeWeeksForDay(date, weeksCoveringDay(date, weeks))) {
    if (week.assignment) {
      return { week, assignment: week.assignment };
    }
  }
  return null;
}

export function weekForDay(date: Date, weeks: CalendarWeek[]): CalendarWeek | null {
  const covering = prioritizeWeeksForDay(date, weeksCoveringDay(date, weeks));
  return covering[0] ?? null;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function itemsForDay<T extends { start_date: string; end_date: string }>(
  date: Date,
  items: T[],
): T[] {
  const key = dateKey(date);
  return items.filter((i) => key >= i.start_date && key <= i.end_date);
}

export function notesForDay(date: Date, notes: CalendarNote[]): CalendarNote[] {
  return itemsForDay(date, notes);
}

export function occupancyForDay(date: Date, occupancy: OccupancyIndicator[]): OccupancyIndicator[] {
  return itemsForDay(date, occupancy);
}

/** Dominant occupancy for cell badge: red if any household marked red that day */
export function occupancyBadgeForDay(
  date: Date,
  occupancy: OccupancyIndicator[],
): "green" | "red" | null {
  const dayItems = occupancyForDay(date, occupancy);
  if (dayItems.length === 0) return null;
  if (dayItems.some((o) => o.status === "red")) return "red";
  return "green";
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
