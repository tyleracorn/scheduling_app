import { AppError } from "../lib/errors.js";
import type { PeriodStatus } from "@prisma/client";
import { addDays, parseDateString, toDateString } from "../lib/dates.js";
import { startOfWeek } from "../lib/dates.js";
import { computePeriodWeeksExact } from "../lib/period-weeks.js";
import { prisma } from "../lib/prisma.js";
import { createPeriod, getSystemSettings } from "./periods.js";

/** Periods that occupy calendar time — generation must not overlap these. */
const BLOCKING_STATUSES: PeriodStatus[] = [
  "scheduled",
  "open",
  "draft",
  "assignment",
  "published",
];

async function findOverlappingPeriod(periodStart: Date, endDate: Date) {
  return prisma.schedulingPeriod.findFirst({
    where: {
      startDate: { lte: endDate },
      endDate: { gte: periodStart },
      status: { in: BLOCKING_STATUSES },
    },
  });
}

function formatBlockingStatus(status: PeriodStatus): string {
  const labels: Record<PeriodStatus, string> = {
    scheduled: "scheduled",
    open: "open",
    draft: "draft",
    assignment: "assignment",
    published: "published",
    archived: "archived",
  };
  return labels[status] ?? status;
}

export function formatPeriodPlan(settings: Awaited<ReturnType<typeof getSystemSettings>>) {
  return {
    first_week_start: settings.periodFirstWeekStart
      ? toDateString(settings.periodFirstWeekStart)
      : null,
    weeks_per_period: settings.periodWeekCount,
    rounds_per_household: settings.weekSelectionsPerHousehold,
    periods_to_schedule: settings.periodsToSchedule,
    week_start_day: settings.weekStartDay,
  };
}

export async function getPeriodPlan() {
  const settings = await getSystemSettings();
  return formatPeriodPlan(settings);
}

export async function savePeriodPlan(input: {
  first_week_start: string;
  weeks_per_period: number;
  rounds_per_household: number;
  periods_to_schedule: number;
  week_start_day: number;
  updated_by_user_id: string;
}) {
  if (input.weeks_per_period < 1 || input.weeks_per_period > 52) {
    throw new AppError(400, "validation_error", "weeks_per_period must be 1–52");
  }
  if (input.rounds_per_household < 1 || input.rounds_per_household > 10) {
    throw new AppError(400, "validation_error", "rounds_per_household must be 1–10");
  }
  if (input.periods_to_schedule < 1 || input.periods_to_schedule > 12) {
    throw new AppError(400, "validation_error", "periods_to_schedule must be 1–12");
  }
  if (input.week_start_day < 0 || input.week_start_day > 6) {
    throw new AppError(400, "validation_error", "week_start_day must be 0–6");
  }

  await prisma.systemSettings.update({
    where: { id: 1 },
    data: {
      periodFirstWeekStart: parseDateString(input.first_week_start),
      periodWeekCount: input.weeks_per_period,
      weekSelectionsPerHousehold: input.rounds_per_household,
      periodsToSchedule: input.periods_to_schedule,
      weekStartDay: input.week_start_day,
      updatedByUserId: input.updated_by_user_id,
    },
  });
  return getPeriodPlan();
}

export async function generatePeriodsFromPlan(
  createdByUserId: string,
  options: { replace_unstarted?: boolean } = {},
) {
  const settings = await getSystemSettings();
  if (!settings.periodFirstWeekStart) {
    throw new AppError(422, "plan_incomplete", "Save a period plan with a first week start date first");
  }

  if (options.replace_unstarted) {
    await prisma.schedulingPeriod.deleteMany({
      where: { status: { in: ["scheduled", "open"] } },
    });
  }

  const planAnchor = startOfWeek(settings.periodFirstWeekStart, settings.weekStartDay);
  const existingCount = await prisma.schedulingPeriod.count({
    where: { status: { in: BLOCKING_STATUSES } },
  });
  const created: { id: string; name: string; start_date: string; end_date: string }[] = [];
  const skipped: string[] = [];

  let slot = 0;
  let createdThisRun = 0;
  const maxSlots = Math.max(settings.periodsToSchedule * 4, 24);

  while (createdThisRun < settings.periodsToSchedule && slot < maxSlots) {
    const periodStart = addDays(planAnchor, slot * settings.periodWeekCount * 7);
    slot += 1;
    const weeks = computePeriodWeeksExact(
      periodStart,
      settings.periodWeekCount,
      settings.weekStartDay,
    );
    const endDate = weeks[weeks.length - 1].weekEndDate;
    const startStr = toDateString(periodStart);
    const endStr = toDateString(endDate);

    const overlap = await findOverlappingPeriod(periodStart, endDate);
    if (overlap) {
      skipped.push(
        `${startStr} – ${endStr} (overlaps "${overlap.name}" [${formatBlockingStatus(overlap.status)}] — change week start day/first start, delete unstarted periods, or use Replace unstarted)`,
      );
      continue;
    }

    const periodNumber = existingCount + createdThisRun + 1;
    const period = await createPeriod({
      name: `Period ${periodNumber} (${startStr})`,
      start_date: startStr,
      end_date: endStr,
      opening_at: new Date().toISOString(),
      created_by_user_id: createdByUserId,
    });
    created.push({
      id: period.id,
      name: period.name,
      start_date: period.start_date,
      end_date: period.end_date,
    });
    createdThisRun += 1;
  }

  if (createdThisRun < settings.periodsToSchedule) {
    skipped.push(
      `Only ${createdThisRun} of ${settings.periodsToSchedule} periods could be placed on the plan grid without overlapping existing periods.`,
    );
  }

  return { created, skipped };
}

export async function deletePeriod(periodId: string) {
  const period = await prisma.schedulingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new AppError(404, "not_found", "Period not found");
  if (period.status !== "scheduled" && period.status !== "open") {
    throw new AppError(
      422,
      "invalid_state",
      "Only scheduled or open periods can be deleted. Published or in-progress periods must stay for history.",
    );
  }
  await prisma.schedulingPeriod.delete({ where: { id: periodId } });
}

/** Clear picks/assignments and return period to open (for testing or restarting a cycle). */
export async function resetPeriod(periodId: string) {
  const period = await prisma.schedulingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new AppError(404, "not_found", "Period not found");
  if (period.status === "scheduled" || period.status === "archived") {
    throw new AppError(
      422,
      "invalid_state",
      "Only open, draft, assignment, or published periods can be reset",
    );
  }

  await prisma.$transaction([
    prisma.assignment.deleteMany({ where: { schedulingPeriodId: periodId } }),
    prisma.draftTurn.deleteMany({ where: { schedulingPeriodId: periodId } }),
    prisma.occupancyIndicator.deleteMany({
      where: {
        startDate: { lte: period.endDate },
        endDate: { gte: period.startDate },
      },
    }),
    prisma.schedulingPeriod.update({
      where: { id: periodId },
      data: {
        status: "open",
        draftStartedAt: null,
        publishedAt: null,
        consecutiveAutoSkips: 0,
        draftOnHold: false,
        currentRound: 1,
      },
    }),
  ]);

  return { ok: true, status: "open" as const };
}
