import { prisma } from "../lib/prisma.js";
import { parseDateString, toDateString } from "../lib/dates.js";

type WeekRange = { weekStartDate: Date; weekEndDate: Date };

function shiftDate(d: Date, dayOffset: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + dayOffset);
  return next;
}

function dayOffset(fromStart: Date, toStart: Date): number {
  return Math.round((toStart.getTime() - fromStart.getTime()) / 86_400_000);
}

/** Remove occupancy for given households overlapping a scheduling week. */
export async function clearOccupancyOnWeek(
  week: WeekRange,
  householdIds: string[],
): Promise<void> {
  if (householdIds.length === 0) return;
  await prisma.occupancyIndicator.deleteMany({
    where: {
      householdId: { in: householdIds },
      startDate: { lte: week.weekEndDate },
      endDate: { gte: week.weekStartDate },
    },
  });
}

/** Replace household occupancy on a week with a single full-week indicator (or clear only). */
export async function setFullWeekOccupancy(
  householdId: string,
  week: WeekRange,
  status: "green" | "red" | null,
  createdByUserId: string,
): Promise<void> {
  await clearOccupancyOnWeek(week, [householdId]);
  if (!status) return;
  await prisma.occupancyIndicator.create({
    data: {
      householdId,
      startDate: week.weekStartDate,
      endDate: week.weekEndDate,
      status,
      createdByUserId,
    },
  });
}

/** After assignment changes, clear prior owner and set new owner's week-level occupancy. */
export async function applyOccupancyForAssignmentChange(
  week: WeekRange,
  previousHouseholdId: string | null,
  newHouseholdId: string,
  status: "green" | "red" | null,
  actorUserId: string,
): Promise<void> {
  const toClear = [newHouseholdId];
  if (previousHouseholdId && previousHouseholdId !== newHouseholdId) {
    toClear.push(previousHouseholdId);
  }
  await clearOccupancyOnWeek(week, toClear);
  if (status) {
    await setFullWeekOccupancy(newHouseholdId, week, status, actorUserId);
  }
}

/** Move a household's occupancy from one week's dates to another (preserves per-day ranges). */
export async function moveHouseholdOccupancyBetweenWeeks(
  householdId: string,
  fromWeek: WeekRange,
  toWeek: WeekRange,
  actorUserId: string,
): Promise<void> {
  const offset = dayOffset(fromWeek.weekStartDate, toWeek.weekStartDate);
  if (offset === 0) return;

  const rows = await prisma.occupancyIndicator.findMany({
    where: {
      householdId,
      startDate: { lte: fromWeek.weekEndDate },
      endDate: { gte: fromWeek.weekStartDate },
    },
  });

  await clearOccupancyOnWeek(fromWeek, [householdId]);

  for (const row of rows) {
    await prisma.occupancyIndicator.create({
      data: {
        householdId,
        startDate: shiftDate(row.startDate, offset),
        endDate: shiftDate(row.endDate, offset),
        status: row.status,
        createdByUserId: actorUserId,
      },
    });
  }
}

/** Set or clear occupancy for one calendar day without disturbing other days in a range. */
export async function setHouseholdDayOccupancy(
  householdId: string,
  dateStr: string,
  status: "green" | "red" | null,
  actorUserId: string,
): Promise<void> {
  const date = parseDateString(dateStr);
  const overlapping = await prisma.occupancyIndicator.findMany({
    where: {
      householdId,
      startDate: { lte: date },
      endDate: { gte: date },
    },
  });

  for (const row of overlapping) {
    const start = row.startDate;
    const end = row.endDate;
    await prisma.occupancyIndicator.delete({ where: { id: row.id } });

    const dayBefore = shiftDate(date, -1);
    if (start <= dayBefore) {
      await prisma.occupancyIndicator.create({
        data: {
          householdId,
          startDate: start,
          endDate: dayBefore,
          status: row.status,
          createdByUserId: actorUserId,
        },
      });
    }

    const dayAfter = shiftDate(date, 1);
    if (dayAfter <= end) {
      await prisma.occupancyIndicator.create({
        data: {
          householdId,
          startDate: dayAfter,
          endDate: end,
          status: row.status,
          createdByUserId: actorUserId,
        },
      });
    }
  }

  if (status) {
    await prisma.occupancyIndicator.create({
      data: {
        householdId,
        startDate: date,
        endDate: date,
        status,
        createdByUserId: actorUserId,
      },
    });
  }
}

export async function applyOccupancyForPeriodWeekId(
  householdId: string,
  periodWeekId: string,
  status: "green" | "red" | null,
  createdByUserId: string,
): Promise<void> {
  const week = await prisma.periodWeek.findUnique({ where: { id: periodWeekId } });
  if (!week) return;
  await setFullWeekOccupancy(
    householdId,
    { weekStartDate: week.weekStartDate, weekEndDate: week.weekEndDate },
    status,
    createdByUserId,
  );
}

export function weekRangeFromDates(start: Date, end: Date): WeekRange {
  return { weekStartDate: start, weekEndDate: end };
}

export { toDateString };
