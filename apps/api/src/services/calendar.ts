import type { PeriodStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { parseDateString, toDateString } from "../lib/dates.js";

export type CalendarQuery = { start: string; end: string };

export async function getCalendarAggregate(query: CalendarQuery) {
  const rangeStart = parseDateString(query.start);
  const rangeEnd = parseDateString(query.end);

  const settings = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });

  const periods = await prisma.schedulingPeriod.findMany({
    where: {
      startDate: { lte: rangeEnd },
      endDate: { gte: rangeStart },
      status: { not: "archived" },
    },
    orderBy: { startDate: "asc" },
  });

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

  return {
    range: { start: query.start, end: query.end },
    settings: {
      cabin_timezone: settings.cabinTimezone,
      week_start_day: settings.weekStartDay,
    },
    periods: periods.map((p) => formatPeriodSummary(p, activeTurnByPeriod.get(p.id))),
    weeks: periodWeeks.map((pw) => formatWeek(pw)),
    notes: [] as unknown[],
    occupancy: [] as unknown[],
  };
}

function formatPeriodSummary(
  period: {
    id: string;
    name: string;
    status: PeriodStatus;
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
    assignment: a
      ? {
          household_id: a.householdId,
          household_name: a.household.name,
          color: a.household.color,
          source: a.source,
          updated_at: a.updatedAt.toISOString(),
        }
      : null,
  };
}
