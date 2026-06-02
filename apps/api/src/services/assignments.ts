import type { AssignmentSource } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { toDateString } from "../lib/dates.js";
import { prisma } from "../lib/prisma.js";
import { notifyAllUsers, notifyHousehold } from "./notifications.js";
import {
  applyOccupancyForAssignmentChange,
  moveHouseholdOccupancyBetweenWeeks,
  weekRangeFromDates,
} from "./occupancy-week.js";

export async function getUnassignedWeeks(periodId: string) {
  const period = await prisma.schedulingPeriod.findUnique({
    where: { id: periodId },
    include: {
      weeks: { orderBy: { sortOrder: "asc" }, include: { assignment: true } },
    },
  });
  if (!period) throw new AppError(404, "not_found", "Period not found");

  const unassigned = period.weeks
    .filter((w) => !w.assignment)
    .map((w) => ({
      period_week_id: w.id,
      week_start_date: toDateString(w.weekStartDate),
      week_end_date: toDateString(w.weekEndDate),
    }));

  return { period_id: periodId, period_name: period.name, status: period.status, weeks: unassigned };
}

export async function getAssignedWeeks(periodId: string) {
  const period = await prisma.schedulingPeriod.findUnique({
    where: { id: periodId },
    include: {
      weeks: {
        orderBy: { sortOrder: "asc" },
        include: { assignment: { include: { household: true } } },
      },
    },
  });
  if (!period) throw new AppError(404, "not_found", "Period not found");

  const weeks = period.weeks
    .filter((w) => w.assignment)
    .map((w) => ({
      period_week_id: w.id,
      week_start_date: toDateString(w.weekStartDate),
      week_end_date: toDateString(w.weekEndDate),
      household_id: w.assignment!.householdId,
      household_name: w.assignment!.household.name,
    }));

  return { period_id: periodId, period_name: period.name, status: period.status, weeks };
}

export async function assignWeek(
  periodId: string,
  weekId: string,
  householdId: string,
  actorUserId: string,
  reason?: string,
  occupancyStatus?: "green" | "red" | null,
) {
  const period = await prisma.schedulingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new AppError(404, "not_found", "Period not found");
  if (period.status !== "assignment" && period.status !== "published") {
    throw new AppError(422, "invalid_state", "Assignments can only be changed during assignment or after publish");
  }

  const week = await prisma.periodWeek.findFirst({
    where: { id: weekId, schedulingPeriodId: periodId },
    include: { assignment: { include: { household: true } } },
  });
  if (!week) throw new AppError(404, "not_found", "Week not found in this period");

  const household = await prisma.household.findFirst({
    where: { id: householdId, active: true },
  });
  if (!household) throw new AppError(404, "not_found", "Household not found");

  const isPublishedEdit = period.status === "published";
  if (isPublishedEdit && !reason?.trim()) {
    throw new AppError(400, "validation_error", "Reason is required when changing a published assignment");
  }

  const before = week.assignment
    ? {
        household_id: week.assignment.householdId,
        household_name: week.assignment.household.name,
      }
    : null;

  const previousHouseholdId = week.assignment?.householdId ?? null;

  const source: AssignmentSource = isPublishedEdit ? "coordinator_edit" : "coordinator_manual";

  const assignment = await prisma.assignment.upsert({
    where: { periodWeekId: weekId },
    create: {
      schedulingPeriodId: periodId,
      periodWeekId: weekId,
      householdId,
      source,
    },
    update: {
      householdId,
      source,
      draftTurnId: null,
    },
    include: { household: true },
  });

  if (occupancyStatus !== undefined) {
    await applyOccupancyForAssignmentChange(
      weekRangeFromDates(week.weekStartDate, week.weekEndDate),
      previousHouseholdId,
      householdId,
      occupancyStatus,
      actorUserId,
    );
  }

  if (isPublishedEdit) {
    await prisma.auditEvent.create({
      data: {
        actorUserId,
        eventType: "assignment_changed",
        entityType: "assignment",
        entityId: assignment.id,
        before: before ?? undefined,
        after: {
          household_id: household.id,
          household_name: household.name,
          week_start_date: toDateString(week.weekStartDate),
        },
        reason: reason!.trim(),
      },
    });

    const affectedHouseholdIds = new Set<string>([householdId]);
    if (before?.household_id) affectedHouseholdIds.add(before.household_id);

    for (const hhId of affectedHouseholdIds) {
      await notifyHousehold(
        hhId,
        "assignment_changed",
        "Calendar assignment updated",
        `${period.name}: week of ${toDateString(week.weekStartDate)} was reassigned. Reason: ${reason!.trim()}`,
        { period_id: periodId, period_week_id: weekId },
      );
    }
  }

  return {
    assignment: {
      period_week_id: weekId,
      household_id: assignment.householdId,
      household_name: assignment.household.name,
      color: assignment.household.color,
      source: assignment.source,
      updated_at: assignment.updatedAt.toISOString(),
    },
  };
}

export async function swapWeeks(
  periodId: string,
  weekIdA: string,
  weekIdB: string,
  actorUserId: string,
  occupancyA?: "green" | "red" | null,
  occupancyB?: "green" | "red" | null,
  reason?: string,
) {
  const period = await prisma.schedulingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new AppError(404, "not_found", "Period not found");
  if (period.status !== "assignment" && period.status !== "published") {
    throw new AppError(422, "invalid_state", "Weeks can only be swapped during assignment or after publish");
  }
  if (weekIdA === weekIdB) {
    throw new AppError(400, "validation_error", "Select two different weeks");
  }

  const [weekA, weekB] = await Promise.all([
    prisma.periodWeek.findFirst({
      where: { id: weekIdA, schedulingPeriodId: periodId },
      include: { assignment: { include: { household: true } } },
    }),
    prisma.periodWeek.findFirst({
      where: { id: weekIdB, schedulingPeriodId: periodId },
      include: { assignment: { include: { household: true } } },
    }),
  ]);
  if (!weekA || !weekB) throw new AppError(404, "not_found", "Week not found in this period");
  if (!weekA.assignment || !weekB.assignment) {
    throw new AppError(422, "invalid_state", "Both weeks must be assigned before swapping");
  }

  const hhA = weekA.assignment.householdId;
  const hhB = weekB.assignment.householdId;
  if (hhA === hhB) {
    throw new AppError(422, "invalid_state", "Weeks are already assigned to the same household");
  }

  const isPublished = period.status === "published";
  if (isPublished && !reason?.trim()) {
    throw new AppError(400, "validation_error", "Reason is required when swapping published weeks");
  }

  const rangeA = weekRangeFromDates(weekA.weekStartDate, weekA.weekEndDate);
  const rangeB = weekRangeFromDates(weekB.weekStartDate, weekB.weekEndDate);

  await prisma.$transaction([
    prisma.assignment.update({
      where: { periodWeekId: weekIdA },
      data: { householdId: hhB, source: isPublished ? "coordinator_edit" : "coordinator_manual" },
    }),
    prisma.assignment.update({
      where: { periodWeekId: weekIdB },
      data: { householdId: hhA, source: isPublished ? "coordinator_edit" : "coordinator_manual" },
    }),
  ]);

  if (occupancyA !== undefined || occupancyB !== undefined) {
    if (occupancyA !== undefined) {
      await applyOccupancyForAssignmentChange(rangeA, hhA, hhB, occupancyA, actorUserId);
    } else {
      await moveHouseholdOccupancyBetweenWeeks(hhA, rangeA, rangeB, actorUserId);
    }
    if (occupancyB !== undefined) {
      await applyOccupancyForAssignmentChange(rangeB, hhB, hhA, occupancyB, actorUserId);
    } else {
      await moveHouseholdOccupancyBetweenWeeks(hhB, rangeB, rangeA, actorUserId);
    }
  } else {
    await moveHouseholdOccupancyBetweenWeeks(hhA, rangeA, rangeB, actorUserId);
    await moveHouseholdOccupancyBetweenWeeks(hhB, rangeB, rangeA, actorUserId);
  }

  if (isPublished) {
    await prisma.auditEvent.create({
      data: {
        actorUserId,
        eventType: "weeks_swapped",
        entityType: "scheduling_period",
        entityId: periodId,
        after: {
          week_a: toDateString(weekA.weekStartDate),
          week_b: toDateString(weekB.weekStartDate),
          household_a: weekA.assignment.household.name,
          household_b: weekB.assignment.household.name,
        },
        reason: reason!.trim(),
      },
    });
    for (const hhId of [hhA, hhB]) {
      await notifyHousehold(
        hhId,
        "assignment_changed",
        "Calendar weeks swapped",
        `${period.name}: your week was swapped with another household. Reason: ${reason!.trim()}`,
        { period_id: periodId },
      );
    }
  }

  return { ok: true };
}

export async function getPeriodAssignmentSummary(periodId: string) {
  const period = await prisma.schedulingPeriod.findUnique({
    where: { id: periodId },
    include: {
      weeks: { include: { assignment: { include: { household: true } } } },
    },
  });
  if (!period) throw new AppError(404, "not_found", "Period not found");

  const settings = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
  const households = await prisma.household.findMany({
    where: { active: true },
    orderBy: [{ isWorkerBee: "asc" }, { name: "asc" }],
  });

  const counts = new Map<string, number>();
  for (const week of period.weeks) {
    if (week.assignment) {
      counts.set(
        week.assignment.householdId,
        (counts.get(week.assignment.householdId) ?? 0) + 1,
      );
    }
  }

  const totalWeeks = period.weeks.length;
  const assignedWeeks = period.weeks.filter((w) => w.assignment).length;
  const owningCount = households.filter((h) => !h.isWorkerBee).length;
  const evenSplit = owningCount > 0 ? totalWeeks / owningCount : null;

  return {
    period_id: periodId,
    period_name: period.name,
    status: period.status,
    total_weeks: totalWeeks,
    assigned_weeks: assignedWeeks,
    unassigned_weeks: totalWeeks - assignedWeeks,
    draft_picks_per_household: settings.weekSelectionsPerHousehold,
    even_split_hint: evenSplit,
    households: households.map((h) => ({
      household_id: h.id,
      household_name: h.name,
      color: h.color,
      is_worker_bee: h.isWorkerBee,
      weeks_assigned: counts.get(h.id) ?? 0,
      draft_pick_target: h.isWorkerBee ? null : settings.weekSelectionsPerHousehold,
    })),
  };
}

export async function publishPeriod(periodId: string, actorUserId: string) {
  const period = await prisma.schedulingPeriod.findUnique({
    where: { id: periodId },
    include: {
      weeks: { include: { assignment: true } },
    },
  });
  if (!period) throw new AppError(404, "not_found", "Period not found");
  if (period.status !== "assignment") {
    throw new AppError(422, "invalid_state", "Only periods in assignment phase can be published");
  }

  const unassigned = period.weeks.filter((w) => !w.assignment);
  if (unassigned.length > 0) {
    throw new AppError(
      422,
      "unassigned_weeks",
      `${unassigned.length} week(s) still unassigned. Assign all weeks before publishing.`,
    );
  }

  await prisma.schedulingPeriod.update({
    where: { id: periodId },
    data: {
      status: "published",
      publishedAt: new Date(),
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId,
      eventType: "period_published",
      entityType: "scheduling_period",
      entityId: periodId,
      after: { name: period.name, published_at: new Date().toISOString() },
    },
  });

  await notifyAllUsers(
    "period_published",
    "Schedule published",
    `${period.name} is now published. View the calendar for final assignments.`,
    { period_id: periodId },
  );

  return {
    period: {
      id: period.id,
      name: period.name,
      status: "published",
      published_at: new Date().toISOString(),
    },
  };
}
