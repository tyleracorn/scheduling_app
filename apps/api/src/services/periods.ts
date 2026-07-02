import type { PeriodStatus, Prisma } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { parseDateString, toDateString } from "../lib/dates.js";
import { computeDraftStartAtFromString } from "../lib/period-schedule.js";
import {
  mergeNewHouseholds,
  periodQualifiesAsPredecessor,
  prioritiesFromOrder,
  rotateHouseholdOrder,
} from "../lib/priority-rotation.js";
import {
  computePeriodWeeks,
  periodBoundsFromWeeks,
  type PeriodWeekRow,
} from "../lib/period-weeks.js";
import { prisma } from "../lib/prisma.js";

const BLOCKING_STATUSES: PeriodStatus[] = [
  "scheduled",
  "open",
  "draft",
  "assignment",
  "published",
];

export async function getSystemSettings() {
  return prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
}

export async function materializePeriodWeeksFromRows(periodId: string, rows: PeriodWeekRow[]) {
  await prisma.periodWeek.deleteMany({ where: { schedulingPeriodId: periodId } });
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

  const bounds = periodBoundsFromWeeks(rows);
  if (bounds) {
    await prisma.schedulingPeriod.update({
      where: { id: periodId },
      data: {
        startDate: bounds.startDate,
        endDate: bounds.endDate,
      },
    });
  }
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

  const bounds = periodBoundsFromWeeks(rows);
  if (bounds) {
    await prisma.schedulingPeriod.update({
      where: { id: periodId },
      data: {
        startDate: bounds.startDate,
        endDate: bounds.endDate,
      },
    });
  }
}

export async function getActiveDraftHouseholds() {
  return prisma.household.findMany({
    where: { active: true, isWorkerBee: false },
    orderBy: { name: "asc" },
  });
}

async function getPreviousPeriodForRotation(currentPeriodId: string) {
  const current = await prisma.schedulingPeriod.findUnique({
    where: { id: currentPeriodId },
    include: { weeks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!current) return null;

  const currentStart = effectivePeriodBounds(current).startDate;
  const candidates = await prisma.schedulingPeriod.findMany({
    where: {
      id: { not: currentPeriodId },
      status: { in: BLOCKING_STATUSES },
    },
    include: {
      weeks: { orderBy: { sortOrder: "asc" } },
      priorities: { orderBy: { position: "asc" } },
    },
  });

  let best: (typeof candidates)[number] | null = null;
  let bestEnd: Date | null = null;

  for (const period of candidates) {
    const end = effectivePeriodBounds(period).endDate;
    if (!periodQualifiesAsPredecessor(end, currentStart)) continue;
    if (!bestEnd || end.getTime() > bestEnd.getTime()) {
      best = period;
      bestEnd = end;
    }
  }

  return best;
}

export async function getRotatedDefaultPriorities(
  periodId: string,
): Promise<{ household_id: string; position: number }[]> {
  const activeHouseholds = await getActiveDraftHouseholds();
  const activeIds = activeHouseholds.map((h) => h.id);
  const activeIdSet = new Set(activeIds);

  const previous = await getPreviousPeriodForRotation(periodId);
  const previousPriorities = previous?.priorities ?? [];

  if (previousPriorities.length === 0) {
    return prioritiesFromOrder(activeIds);
  }

  const previousOrder = previousPriorities
    .filter((p) => activeIdSet.has(p.householdId))
    .sort((a, b) => a.position - b.position)
    .map((p) => p.householdId);

  if (previousOrder.length === 0) {
    return prioritiesFromOrder(activeIds);
  }

  const lastPickerId = previousPriorities.reduce(
    (best, p) => (p.position > best.position ? p : best),
    previousPriorities[0]!,
  ).householdId;

  const rotated = rotateHouseholdOrder(
    previousOrder,
    activeIdSet.has(lastPickerId) ? lastPickerId : previousOrder[previousOrder.length - 1]!,
  );
  const merged = mergeNewHouseholds(rotated, activeIds);

  return prioritiesFromOrder(merged);
}

async function applyDefaultPriorities(periodId: string) {
  const items = await getRotatedDefaultPriorities(periodId);
  await prisma.periodHouseholdPriority.deleteMany({ where: { schedulingPeriodId: periodId } });
  if (items.length > 0) {
    await prisma.periodHouseholdPriority.createMany({
      data: items.map((i) => ({
        schedulingPeriodId: periodId,
        householdId: i.household_id,
        position: i.position,
      })),
    });
  }
}

export async function setDefaultPriorities(periodId: string) {
  await applyDefaultPriorities(periodId);
}

export async function resetPeriodPriorities(periodId: string) {
  const period = await prisma.schedulingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new AppError(404, "not_found", "Period not found");
  if (period.status !== "scheduled" && period.status !== "open") {
    throw new AppError(422, "invalid_state", "Priorities can only be reset before draft");
  }
  await applyDefaultPriorities(periodId);
  return getPeriodDetail(periodId);
}

type PeriodRow = Prisma.SchedulingPeriodGetPayload<{
  include: { weeks: true; priorities: { include: { household: true } } };
}>;

type PeriodWeekSlice = {
  weekStartDate: Date;
  weekEndDate: Date;
  sortOrder: number;
};

/** Calendar bounds from materialized weeks, falling back to stored period dates. */
export function effectivePeriodBounds(period: {
  startDate: Date;
  endDate: Date;
  weeks: PeriodWeekSlice[];
}): { startDate: Date; endDate: Date } {
  const bounds = periodBoundsFromWeeks(
    period.weeks.map((w) => ({
      weekStartDate: w.weekStartDate,
      weekEndDate: w.weekEndDate,
      sortOrder: w.sortOrder,
    })),
  );
  return {
    startDate: bounds?.startDate ?? period.startDate,
    endDate: bounds?.endDate ?? period.endDate,
  };
}

export function formatPeriod(period: PeriodRow) {
  const { startDate, endDate } = effectivePeriodBounds(period);

  return {
    id: period.id,
    name: period.name,
    start_date: toDateString(startDate),
    end_date: toDateString(endDate),
    opening_at: period.openingAt.toISOString(),
    draft_start_at: period.draftStartAt?.toISOString() ?? null,
    auto_draft_paused: period.autoDraftPaused,
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
  opening_at?: string;
  draft_start_at?: string;
  created_by_user_id: string;
}) {
  if (input.start_date > input.end_date) {
    throw new AppError(400, "validation_error", "start_date must be on or before end_date");
  }
  const settings = await getSystemSettings();
  const startDate = parseDateString(input.start_date);
  const endDate = parseDateString(input.end_date);
  const now = new Date();
  const openingAt = input.opening_at ? new Date(input.opening_at) : now;
  const draftStartAt =
    input.draft_start_at != null
      ? new Date(input.draft_start_at)
      : computeDraftStartAtFromString(input.start_date, settings.draftStartLeadDays);

  const period = await prisma.schedulingPeriod.create({
    data: {
      name: input.name,
      startDate,
      endDate,
      openingAt,
      draftStartAt,
      status: "open",
      createdByUserId: input.created_by_user_id,
    },
  });
  await materializePeriodWeeks(period.id, startDate, endDate, settings.weekStartDay);
  await setDefaultPriorities(period.id);
  return getPeriodDetail(period.id);
}

export async function createPeriodWithWeeks(input: {
  name: string;
  weeks: PeriodWeekRow[];
  opening_at?: string;
  draft_start_at?: string;
  created_by_user_id: string;
}) {
  const bounds = periodBoundsFromWeeks(input.weeks);
  if (!bounds) {
    throw new AppError(400, "validation_error", "Period must include at least one week");
  }
  const settings = await getSystemSettings();
  const now = new Date();
  const openingAt = input.opening_at ? new Date(input.opening_at) : now;
  const draftStartAt =
    input.draft_start_at != null
      ? new Date(input.draft_start_at)
      : computeDraftStartAtFromString(toDateString(bounds.startDate), settings.draftStartLeadDays);

  const period = await prisma.schedulingPeriod.create({
    data: {
      name: input.name,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      openingAt,
      draftStartAt,
      status: "open",
      createdByUserId: input.created_by_user_id,
    },
  });
  await materializePeriodWeeksFromRows(period.id, input.weeks);
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

  const activeHouseholds = await getActiveDraftHouseholds();
  const expectedCount = activeHouseholds.length;
  const activeIdSet = new Set(activeHouseholds.map((h) => h.id));

  if (items.length !== expectedCount) {
    throw new AppError(
      400,
      "validation_error",
      `Expected ${expectedCount} household priorities, got ${items.length}`,
    );
  }

  const householdIds = new Set(items.map((i) => i.household_id));
  if (householdIds.size !== items.length) {
    throw new AppError(400, "validation_error", "Duplicate households in priorities");
  }

  for (const item of items) {
    if (!activeIdSet.has(item.household_id)) {
      throw new AppError(400, "validation_error", "Invalid or inactive household in priorities");
    }
  }

  const positions = new Set(items.map((i) => i.position));
  if (positions.size !== items.length) {
    throw new AppError(400, "validation_error", "Duplicate positions");
  }

  for (let pos = 1; pos <= expectedCount; pos++) {
    if (!positions.has(pos)) {
      throw new AppError(400, "validation_error", "Positions must be consecutive from 1");
    }
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
