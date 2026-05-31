import { AppError } from "../lib/errors.js";
import { addDays, parseDateString, toDateString } from "../lib/dates.js";
import { startOfWeek } from "../lib/dates.js";
import { computePeriodWeeksExact } from "../lib/period-weeks.js";
import { prisma } from "../lib/prisma.js";
import { createPeriod, getSystemSettings } from "./periods.js";

export function formatPeriodPlan(settings: Awaited<ReturnType<typeof getSystemSettings>>) {
  return {
    first_week_start: settings.periodFirstWeekStart
      ? toDateString(settings.periodFirstWeekStart)
      : null,
    weeks_per_period: settings.periodWeekCount,
    open_lead_days: settings.openLeadDays,
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
  open_lead_days: number;
  rounds_per_household: number;
  periods_to_schedule: number;
  week_start_day: number;
  updated_by_user_id: string;
}) {
  if (input.weeks_per_period < 1 || input.weeks_per_period > 52) {
    throw new AppError(400, "validation_error", "weeks_per_period must be 1–52");
  }
  if (input.open_lead_days < 0 || input.open_lead_days > 365) {
    throw new AppError(400, "validation_error", "open_lead_days must be 0–365");
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
      openLeadDays: input.open_lead_days,
      weekSelectionsPerHousehold: input.rounds_per_household,
      periodsToSchedule: input.periods_to_schedule,
      weekStartDay: input.week_start_day,
      updatedByUserId: input.updated_by_user_id,
    },
  });
  return getPeriodPlan();
}

function openingAtForPeriod(periodStart: Date, openLeadDays: number): Date {
  const openDate = addDays(periodStart, -openLeadDays);
  return new Date(
    Date.UTC(
      openDate.getUTCFullYear(),
      openDate.getUTCMonth(),
      openDate.getUTCDate(),
      15,
      0,
      0,
    ),
  );
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

  const anchor = startOfWeek(settings.periodFirstWeekStart, settings.weekStartDay);
  const created: { id: string; name: string; start_date: string; end_date: string }[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < settings.periodsToSchedule; i++) {
    const periodStart = addDays(anchor, i * settings.periodWeekCount * 7);
    const weeks = computePeriodWeeksExact(
      periodStart,
      settings.periodWeekCount,
      settings.weekStartDay,
    );
    const endDate = weeks[weeks.length - 1].weekEndDate;
    const startStr = toDateString(periodStart);
    const endStr = toDateString(endDate);

    const overlap = await prisma.schedulingPeriod.findFirst({
      where: {
        startDate: { lte: endDate },
        endDate: { gte: periodStart },
      },
    });
    if (overlap) {
      skipped.push(`${startStr} – ${endStr} (overlaps ${overlap.name})`);
      continue;
    }

    const openingAt = openingAtForPeriod(periodStart, settings.openLeadDays);
    const period = await createPeriod({
      name: `Period ${i + 1} (${startStr})`,
      start_date: startStr,
      end_date: endStr,
      opening_at: openingAt.toISOString(),
      created_by_user_id: createdByUserId,
    });
    created.push({
      id: period.id,
      name: period.name,
      start_date: period.start_date,
      end_date: period.end_date,
    });
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
