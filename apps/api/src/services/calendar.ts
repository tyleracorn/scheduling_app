import type { PeriodStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { parseDateString, toDateString } from "../lib/dates.js";
import { retentionCutoffDate } from "../lib/retention.js";

export type CalendarQuery = { start: string; end: string };

export async function getCalendarAggregate(query: CalendarQuery) {
  const rangeStart = parseDateString(query.start);
  const rangeEnd = parseDateString(query.end);

  const settings = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });

  const periodsInRange = await prisma.schedulingPeriod.findMany({
    where: {
      startDate: { lte: rangeEnd },
      endDate: { gte: rangeStart },
      status: { not: "archived" },
    },
    orderBy: { startDate: "asc" },
  });

  const inRangeIds = new Set(periodsInRange.map((p) => p.id));
  const activeElsewhere =
    inRangeIds.size === 0
      ? await prisma.schedulingPeriod.findMany({
          where: { status: { in: ["draft", "assignment", "open"] } },
          orderBy: { startDate: "asc" },
        })
      : await prisma.schedulingPeriod.findMany({
          where: {
            status: { in: ["draft", "assignment", "open"] },
            id: { notIn: [...inRangeIds] },
          },
          orderBy: { startDate: "asc" },
        });

  const periods = [...periodsInRange, ...activeElsewhere];

  const periodIds = periods.map((p) => p.id);

  const periodWeeks =
    periodIds.length === 0
      ? []
      : await prisma.periodWeek.findMany({
          where: {
            schedulingPeriodId: { in: periodIds },
            weekStartDate: { lte: rangeEnd },
            weekEndDate: { gte: rangeStart },
          },
          include: {
            assignment: {
              include: { household: true },
            },
            period: { select: { id: true, name: true, status: true } },
          },
          orderBy: [{ weekStartDate: "asc" }],
        });

  const draftPeriodIds = periods.filter((p) => p.status === "draft").map((p) => p.id);
  const activeTurns =
    draftPeriodIds.length === 0
      ? []
      : await prisma.draftTurn.findMany({
          where: { schedulingPeriodId: { in: draftPeriodIds }, status: "active" },
          include: { household: true },
        });
  const activeTurnByPeriod = new Map(activeTurns.map((t) => [t.schedulingPeriodId, t]));

  const retentionCutoff = retentionCutoffDate(settings.historyRetentionYears);
  const minEnd = rangeStart > retentionCutoff ? rangeStart : retentionCutoff;

  const [notes, occupancy] = await Promise.all([
    prisma.calendarNote.findMany({
      where: { startDate: { lte: rangeEnd }, endDate: { gte: minEnd } },
      include: { household: true },
      orderBy: { startDate: "asc" },
    }),
    prisma.occupancyIndicator.findMany({
      where: { startDate: { lte: rangeEnd }, endDate: { gte: minEnd } },
      include: { household: true },
      orderBy: { startDate: "asc" },
    }),
  ]);

  return {
    range: { start: query.start, end: query.end },
    settings: {
      cabin_timezone: settings.cabinTimezone,
      week_start_day: settings.weekStartDay,
      notes_earliest_date: toDateString(retentionCutoff),
    },
    periods: periods.map((p) => formatPeriodSummary(p, activeTurnByPeriod.get(p.id))),
    weeks: periodWeeks.map((pw) => formatWeek(pw)),
    notes: notes.map((n) => ({
      id: n.id,
      household_id: n.householdId,
      household_name: n.household.name,
      start_date: toDateString(n.startDate),
      end_date: toDateString(n.endDate),
      body: n.body,
    })),
    occupancy: occupancy.map((o) => ({
      id: o.id,
      household_id: o.householdId,
      household_name: o.household.name,
      start_date: toDateString(o.startDate),
      end_date: toDateString(o.endDate),
      status: o.status,
    })),
  };
}

function formatPeriodSummary(
  period: {
    id: string;
    name: string;
    status: PeriodStatus;
    startDate: Date;
    endDate: Date;
    currentRound: number;
    draftOnHold: boolean;
  },
  activeTurn?: {
    householdId: string;
    household: { name: string };
    expiresAt: Date | null;
  },
) {
  const base = {
    id: period.id,
    name: period.name,
    status: period.status,
    start_date: toDateString(period.startDate),
    end_date: toDateString(period.endDate),
  };
  if (period.status !== "draft") {
    return base;
  }
  return {
    ...base,
    draft_summary: {
      current_round: period.currentRound,
      on_hold: period.draftOnHold,
      active_turn: activeTurn
        ? {
            household_id: activeTurn.householdId,
            household_name: activeTurn.household.name,
            expires_at: activeTurn.expiresAt?.toISOString() ?? null,
          }
        : null,
    },
  };
}

/** Draft/open weeks only show a household after a draft pick — not pre-filled or from other periods. */
function formatWeekAssignment(
  periodStatus: PeriodStatus,
  a: NonNullable<
    Prisma.PeriodWeekGetPayload<{
      include: { assignment: { include: { household: true } } };
    }>["assignment"]
  >,
) {
  if (periodStatus === "draft" || periodStatus === "open" || periodStatus === "scheduled") {
    if (a.source !== "draft_pick" && a.source !== "coordinator_manual") return null;
  }
  return {
    household_id: a.householdId,
    household_name: a.household.name,
    color: a.household.color,
    source: a.source,
    updated_at: a.updatedAt.toISOString(),
  };
}

function formatWeek(
  pw: Prisma.PeriodWeekGetPayload<{
    include: {
      assignment: { include: { household: true } };
      period: { select: { id: true; name: true; status: true } };
    };
  }>,
) {
  const a = pw.assignment;
  return {
    period_week_id: pw.id,
    period_id: pw.period.id,
    period_name: pw.period.name,
    period_status: pw.period.status,
    week_start_date: toDateString(pw.weekStartDate),
    week_end_date: toDateString(pw.weekEndDate),
    assignment: a ? formatWeekAssignment(pw.period.status, a) : null,
  };
}
