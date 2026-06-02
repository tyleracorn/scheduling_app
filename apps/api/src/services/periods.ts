import type { PeriodStatus, Prisma } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { parseDateString, toDateString } from "../lib/dates.js";
import { computePeriodWeeks } from "../lib/period-weeks.js";
import { prisma } from "../lib/prisma.js";

export async function getSystemSettings() {
  return prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
}

export async function materializePeriodWeeks(
  periodId: string,
  startDate: Date,
  endDate: Date,
  weekStartDay: number,
) {
  await prisma.periodWeek.deleteMany({ where: { schedulingPeriodId: periodId } });
  const rows = computePeriodWeeks(startDate, endDate, weekStartDay);
  if (rows.length === 0) {
    throw new AppError(400, "validation_error", "Period must include at least one week");
  }
  await prisma.periodWeek.createMany({
    data: rows.map((r) => ({
      schedulingPeriodId: periodId,
      weekStartDate: r.weekStartDate,
      weekEndDate: r.weekEndDate,
      sortOrder: r.sortOrder,
    })),
  });
}

export async function setDefaultPriorities(periodId: string) {
  const households = await prisma.household.findMany({
    where: { active: true, isWorkerBee: false },
    orderBy: { name: "asc" },
  });
  await prisma.periodHouseholdPriority.deleteMany({ where: { schedulingPeriodId: periodId } });
  await prisma.periodHouseholdPriority.createMany({
    data: households.map((h, i) => ({
      schedulingPeriodId: periodId,
      householdId: h.id,
      position: i + 1,
    })),
  });
}

type PeriodRow = Prisma.SchedulingPeriodGetPayload<{
  include: { weeks: true; priorities: { include: { household: true } } };
}>;

export function formatPeriod(period: PeriodRow) {
  return {
    id: period.id,
    name: period.name,
    start_date: toDateString(period.startDate),
    end_date: toDateString(period.endDate),
    opening_at: period.openingAt.toISOString(),
    status: period.status,
    draft_started_at: period.draftStartedAt?.toISOString() ?? null,
    published_at: period.publishedAt?.toISOString() ?? null,
    draft_on_hold: period.draftOnHold,
    consecutive_auto_skips: period.consecutiveAutoSkips,
    current_round: period.currentRound,
    weeks: period.weeks.map((w) => ({
      id: w.id,
      week_start_date: toDateString(w.weekStartDate),
      week_end_date: toDateString(w.weekEndDate),
      sort_order: w.sortOrder,
    })),
    priorities: period.priorities.map((p) => ({
      household_id: p.householdId,
      household_name: p.household.name,
      position: p.position,
    })),
  };
}

export async function getPeriodDetail(periodId: string) {
  const period = await prisma.schedulingPeriod.findUnique({
    where: { id: periodId },
    include: {
      weeks: { orderBy: { sortOrder: "asc" } },
      priorities: { orderBy: { position: "asc" }, include: { household: true } },
    },
  });
  if (!period) throw new AppError(404, "not_found", "Period not found");
  return formatPeriod(period);
}

export async function assertPeriodEditable(status: PeriodStatus) {
  if (status !== "scheduled" && status !== "open") {
    throw new AppError(422, "invalid_state", "Period cannot be edited in its current state");
  }
}

export async function createPeriod(input: {
  name: string;
  start_date: string;
  end_date: string;
  opening_at: string;
  created_by_user_id: string;
}) {
  if (input.start_date > input.end_date) {
    throw new AppError(400, "validation_error", "start_date must be on or before end_date");
  }
  const settings = await getSystemSettings();
  const startDate = parseDateString(input.start_date);
  const endDate = parseDateString(input.end_date);
  const openingAt = new Date(input.opening_at);
  const now = new Date();
  const status: PeriodStatus = openingAt <= now ? "open" : "scheduled";

  const period = await prisma.schedulingPeriod.create({
    data: {
      name: input.name,
      startDate,
      endDate,
      openingAt,
      status,
      createdByUserId: input.created_by_user_id,
    },
  });
  await materializePeriodWeeks(period.id, startDate, endDate, settings.weekStartDay);
  await setDefaultPriorities(period.id);
  return getPeriodDetail(period.id);
}

export async function listPeriods(filters?: { status?: PeriodStatus; year?: number }) {
  const where: Prisma.SchedulingPeriodWhereInput = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.year) {
    const start = new Date(Date.UTC(filters.year, 0, 1));
    const end = new Date(Date.UTC(filters.year, 11, 31));
    where.startDate = { lte: end };
    where.endDate = { gte: start };
  }
  const periods = await prisma.schedulingPeriod.findMany({
    where,
    orderBy: { startDate: "desc" },
    include: {
      weeks: { orderBy: { sortOrder: "asc" } },
      priorities: { orderBy: { position: "asc" }, include: { household: true } },
    },
  });
  return periods.map(formatPeriod);
}

export async function updatePeriod(
  periodId: string,
  input: Partial<{ name: string; start_date: string; end_date: string; opening_at: string }>,
) {
  const period = await prisma.schedulingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new AppError(404, "not_found", "Period not found");
  await assertPeriodEditable(period.status);

  const settings = await getSystemSettings();
  const startDate = input.start_date ? parseDateString(input.start_date) : period.startDate;
  const endDate = input.end_date ? parseDateString(input.end_date) : period.endDate;
  if (startDate > endDate) {
    throw new AppError(400, "validation_error", "start_date must be on or before end_date");
  }

  const openingAt = input.opening_at ? new Date(input.opening_at) : period.openingAt;
  const now = new Date();
  let status = period.status;
  if (status === "scheduled" && openingAt <= now) status = "open";
  if (status === "open" && openingAt > now) status = "scheduled";

  await prisma.schedulingPeriod.update({
    where: { id: periodId },
    data: {
      name: input.name ?? period.name,
      startDate,
      endDate,
      openingAt,
      status,
    },
  });

  if (input.start_date || input.end_date) {
    await materializePeriodWeeks(periodId, startDate, endDate, settings.weekStartDay);
  }
  return getPeriodDetail(periodId);
}

export async function setPeriodPriorities(
  periodId: string,
  items: { household_id: string; position: number }[],
) {
  const period = await prisma.schedulingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new AppError(404, "not_found", "Period not found");
  if (period.status !== "scheduled" && period.status !== "open") {
    throw new AppError(422, "invalid_state", "Priorities can only be set before draft");
  }

  const positions = new Set(items.map((i) => i.position));
  if (positions.size !== items.length) {
    throw new AppError(400, "validation_error", "Duplicate positions");
  }

  await prisma.periodHouseholdPriority.deleteMany({ where: { schedulingPeriodId: periodId } });
  await prisma.periodHouseholdPriority.createMany({
    data: items.map((i) => ({
      schedulingPeriodId: periodId,
      householdId: i.household_id,
      position: i.position,
    })),
  });
  return getPeriodDetail(periodId);
}
