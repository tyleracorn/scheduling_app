import { AppError } from "../lib/errors.js";
import type { PeriodStatus } from "@prisma/client";
import { addDays, parseDateString, startOfWeek, toDateString } from "../lib/dates.js";
import {
  computePeriodWeeksExact,
  computePeriodWeeksFromContinuation,
  periodBoundsFromWeeks,
  weekSpanDays,
  type PeriodWeekRow,
} from "../lib/period-weeks.js";
import { prisma } from "../lib/prisma.js";
import { createPeriodWithWeeks, effectivePeriodBounds, getSystemSettings } from "./periods.js";

/** Periods that occupy calendar time — generation must not overlap these. */
const BLOCKING_STATUSES: PeriodStatus[] = [
  "scheduled",
  "open",
  "draft",
  "assignment",
  "published",
];

export type GenerationMode = "incremental" | "grid";

type PreviewWeek = {
  start_date: string;
  end_date: string;
  span_days: number;
  kind: "bridge" | "merged" | "normal";
};

type PreviewPeriod = {
  name: string;
  start_date: string;
  end_date: string;
  week_count: number;
  weeks: PreviewWeek[];
};

type BlockingPeriodWithWeeks = Awaited<ReturnType<typeof loadBlockingPeriodsWithWeeks>>[number];

async function loadBlockingPeriodsWithWeeks() {
  return prisma.schedulingPeriod.findMany({
    where: { status: { in: BLOCKING_STATUSES } },
    include: { weeks: { orderBy: { sortOrder: "asc" } } },
  });
}

function calendarRangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

/** Latest calendar handoff across all blocking periods (uses week-derived bounds). */
async function getBlockingCalendarEnd(): Promise<{
  endDate: Date;
  period: BlockingPeriodWithWeeks;
} | null> {
  const periods = await loadBlockingPeriodsWithWeeks();
  if (periods.length === 0) return null;

  let best = periods[0]!;
  let bestEnd = effectivePeriodBounds(best).endDate;

  for (const period of periods.slice(1)) {
    const end = effectivePeriodBounds(period).endDate;
    if (end.getTime() > bestEnd.getTime()) {
      best = period;
      bestEnd = end;
    }
  }

  return { endDate: bestEnd, period: best };
}

async function findOverlappingPeriod(periodStart: Date, endDate: Date) {
  const periods = await loadBlockingPeriodsWithWeeks();
  for (const period of periods) {
    const bounds = effectivePeriodBounds(period);
    if (calendarRangesOverlap(bounds.startDate, bounds.endDate, periodStart, endDate)) {
      return period;
    }
  }
  return null;
}

async function findCollisionInRange(rangeStart: Date, rangeEnd: Date, excludePeriodId?: string) {
  const periods = await loadBlockingPeriodsWithWeeks();
  for (const period of periods) {
    if (excludePeriodId && period.id === excludePeriodId) continue;
    const bounds = effectivePeriodBounds(period);
    if (calendarRangesOverlap(bounds.startDate, bounds.endDate, rangeStart, rangeEnd)) {
      return period;
    }
  }
  return null;
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

function collisionErrorMessage(period: BlockingPeriodWithWeeks) {
  const bounds = effectivePeriodBounds(period);
  return `Period "${period.name}" starts ${toDateString(bounds.startDate)} (${formatBlockingStatus(period.status)}). Delete future unstarted periods before generating.`;
}

export function resolveGenerationMode(
  requested: GenerationMode | undefined,
  hasBlockingPeriods: boolean,
): GenerationMode {
  if (requested) return requested;
  return hasBlockingPeriods ? "incremental" : "grid";
}

function computeNextPeriodStart(
  lastEnd: Date | null,
  weekStartDay: number,
  firstWeekStart: string | null,
  mode: GenerationMode,
): string | null {
  if (mode === "incremental" && lastEnd) {
    return toDateString(lastEnd);
  }
  if (firstWeekStart) {
    return toDateString(startOfWeek(parseDateString(firstWeekStart), weekStartDay));
  }
  return null;
}

function formatPreviewWeeks(weeks: PeriodWeekRow[]): PreviewWeek[] {
  return weeks.map((w) => ({
    start_date: toDateString(w.weekStartDate),
    end_date: toDateString(w.weekEndDate),
    span_days: weekSpanDays(w),
    kind: w.kind ?? "normal",
  }));
}

function computeIncrementalChainEnd(
  lastEnd: Date,
  weekCount: number,
  periodsToSchedule: number,
  weekStartDay: number,
): Date {
  let cursor = lastEnd;
  for (let i = 0; i < periodsToSchedule; i++) {
    const weeks = computePeriodWeeksFromContinuation(cursor, weekCount, weekStartDay);
    const bounds = periodBoundsFromWeeks(weeks);
    if (!bounds) {
      throw new AppError(400, "validation_error", "Could not compute period chain");
    }
    cursor = bounds.endDate;
  }
  return cursor;
}

function buildIncrementalPreview(
  lastEnd: Date,
  weekCount: number,
  periodsToSchedule: number,
  weekStartDay: number,
  existingCount: number,
): PreviewPeriod[] {
  const periods: PreviewPeriod[] = [];
  let cursor = lastEnd;
  for (let i = 0; i < periodsToSchedule; i++) {
    const weeks = computePeriodWeeksFromContinuation(cursor, weekCount, weekStartDay);
    const bounds = periodBoundsFromWeeks(weeks);
    if (!bounds) break;
    const startStr = toDateString(bounds.startDate);
    periods.push({
      name: `Period ${existingCount + i + 1} (${startStr})`,
      start_date: startStr,
      end_date: toDateString(bounds.endDate),
      week_count: weeks.length,
      weeks: formatPreviewWeeks(weeks),
    });
    cursor = bounds.endDate;
  }
  return periods;
}

function buildGridPreview(
  planAnchor: Date,
  weekCount: number,
  periodsToSchedule: number,
  weekStartDay: number,
  existingCount: number,
): PreviewPeriod[] {
  const periods: PreviewPeriod[] = [];
  for (let slot = 0; slot < periodsToSchedule; slot++) {
    const periodStart = addDays(planAnchor, slot * weekCount * 7);
    const weeks = computePeriodWeeksExact(periodStart, weekCount, weekStartDay);
    const bounds = periodBoundsFromWeeks(weeks);
    if (!bounds) break;
    const startStr = toDateString(bounds.startDate);
    periods.push({
      name: `Period ${existingCount + slot + 1} (${startStr})`,
      start_date: startStr,
      end_date: toDateString(bounds.endDate),
      week_count: weeks.length,
      weeks: formatPreviewWeeks(weeks),
    });
  }
  return periods;
}

export async function getPeriodPlanContext(generationMode?: GenerationMode) {
  const settings = await getSystemSettings();
  const calendarEnd = await getBlockingCalendarEnd();
  const hasBlockingPeriods = !!calendarEnd;
  const mode = resolveGenerationMode(generationMode, hasBlockingPeriods);
  const firstWeekStart = settings.periodFirstWeekStart
    ? toDateString(settings.periodFirstWeekStart)
    : null;
  const lastEnd = calendarEnd?.endDate ?? null;

  return {
    first_week_start: firstWeekStart,
    weeks_per_period: settings.periodWeekCount,
    rounds_per_household: settings.weekSelectionsPerHousehold,
    periods_to_schedule: settings.periodsToSchedule,
    week_start_day: settings.weekStartDay,
    draft_start_lead_days: settings.draftStartLeadDays,
    generation_mode: mode,
    last_period_end: lastEnd ? toDateString(lastEnd) : null,
    next_period_start: computeNextPeriodStart(
      lastEnd,
      settings.weekStartDay,
      firstWeekStart,
      mode,
    ),
    has_blocking_periods: hasBlockingPeriods,
  };
}

export async function getPeriodPlan() {
  return getPeriodPlanContext();
}

export async function savePeriodPlan(input: {
  first_week_start: string;
  weeks_per_period: number;
  rounds_per_household: number;
  periods_to_schedule: number;
  week_start_day: number;
  draft_start_lead_days: number;
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
  if (input.draft_start_lead_days < 0 || input.draft_start_lead_days > 365) {
    throw new AppError(400, "validation_error", "draft_start_lead_days must be 0–365");
  }

  await prisma.systemSettings.update({
    where: { id: 1 },
    data: {
      periodFirstWeekStart: parseDateString(input.first_week_start),
      periodWeekCount: input.weeks_per_period,
      weekSelectionsPerHousehold: input.rounds_per_household,
      periodsToSchedule: input.periods_to_schedule,
      weekStartDay: input.week_start_day,
      draftStartLeadDays: input.draft_start_lead_days,
      updatedByUserId: input.updated_by_user_id,
    },
  });
  return getPeriodPlan();
}

async function generateGridPeriods(
  createdByUserId: string,
  settings: Awaited<ReturnType<typeof getSystemSettings>>,
) {
  if (!settings.periodFirstWeekStart) {
    throw new AppError(422, "plan_incomplete", "Save a period plan with a first week start date first");
  }

  const planAnchor = startOfWeek(settings.periodFirstWeekStart, settings.weekStartDay);
  const existingCount = await prisma.schedulingPeriod.count({
    where: { status: { in: BLOCKING_STATUSES } },
  });
  const created: { id: string; name: string; start_date: string; end_date: string }[] = [];

  for (let slot = 0; slot < settings.periodsToSchedule; slot++) {
    const periodStart = addDays(planAnchor, slot * settings.periodWeekCount * 7);
    const weeks = computePeriodWeeksExact(
      periodStart,
      settings.periodWeekCount,
      settings.weekStartDay,
    );
    const bounds = periodBoundsFromWeeks(weeks);
    if (!bounds) {
      throw new AppError(400, "validation_error", "Could not compute period weeks");
    }
    const startStr = toDateString(bounds.startDate);
    const endStr = toDateString(bounds.endDate);

    const overlap = await findOverlappingPeriod(bounds.startDate, bounds.endDate);
    if (overlap) {
      throw new AppError(
        422,
        "period_overlap",
        `${startStr} – ${endStr} overlaps "${overlap.name}" (${formatBlockingStatus(overlap.status)}). Fix the anchor date, delete unstarted periods, or use Replace unstarted.`,
      );
    }

    const periodNumber = existingCount + slot + 1;
    const period = await createPeriodWithWeeks({
      name: `Period ${periodNumber} (${startStr})`,
      weeks,
      created_by_user_id: createdByUserId,
    });
    created.push({
      id: period.id,
      name: period.name,
      start_date: period.start_date,
      end_date: period.end_date,
    });
  }

  return { created, skipped: [] as string[] };
}

async function generateIncrementalPeriods(
  createdByUserId: string,
  settings: Awaited<ReturnType<typeof getSystemSettings>>,
  calendarEnd: NonNullable<Awaited<ReturnType<typeof getBlockingCalendarEnd>>>,
) {
  const chainStart = calendarEnd.endDate;
  const chainEnd = computeIncrementalChainEnd(
    chainStart,
    settings.periodWeekCount,
    settings.periodsToSchedule,
    settings.weekStartDay,
  );

  const collision = await findCollisionInRange(chainStart, chainEnd, calendarEnd.period.id);
  if (collision) {
    throw new AppError(422, "period_collision", collisionErrorMessage(collision));
  }

  const existingCount = await prisma.schedulingPeriod.count({
    where: { status: { in: BLOCKING_STATUSES } },
  });
  const created: { id: string; name: string; start_date: string; end_date: string }[] = [];
  let cursor = chainStart;

  for (let i = 0; i < settings.periodsToSchedule; i++) {
    const weeks = computePeriodWeeksFromContinuation(
      cursor,
      settings.periodWeekCount,
      settings.weekStartDay,
    );
    const bounds = periodBoundsFromWeeks(weeks);
    if (!bounds) {
      throw new AppError(400, "validation_error", "Could not compute period weeks");
    }
    const startStr = toDateString(bounds.startDate);
    const periodNumber = existingCount + i + 1;
    const period = await createPeriodWithWeeks({
      name: `Period ${periodNumber} (${startStr})`,
      weeks,
      created_by_user_id: createdByUserId,
    });
    created.push({
      id: period.id,
      name: period.name,
      start_date: period.start_date,
      end_date: period.end_date,
    });
    cursor = bounds.endDate;
  }

  return { created, skipped: [] as string[] };
}

export async function generatePeriodsFromPlan(
  createdByUserId: string,
  options: { replace_unstarted?: boolean; generation_mode?: GenerationMode } = {},
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

  const calendarEnd = await getBlockingCalendarEnd();
  const mode = resolveGenerationMode(options.generation_mode, !!calendarEnd);

  if (mode === "incremental" && calendarEnd) {
    return generateIncrementalPeriods(createdByUserId, settings, calendarEnd);
  }

  return generateGridPeriods(createdByUserId, settings);
}

export async function previewPeriodsFromPlan(options: { generation_mode?: GenerationMode } = {}) {
  const settings = await getSystemSettings();
  if (!settings.periodFirstWeekStart) {
    throw new AppError(422, "plan_incomplete", "Save a period plan with a first week start date first");
  }

  const calendarEnd = await getBlockingCalendarEnd();
  const mode = resolveGenerationMode(options.generation_mode, !!calendarEnd);
  const existingCount = await prisma.schedulingPeriod.count({
    where: { status: { in: BLOCKING_STATUSES } },
  });

  let periods: PreviewPeriod[] = [];
  let error: string | null = null;
  const lastEnd = calendarEnd?.endDate ?? null;

  if (mode === "incremental" && calendarEnd) {
    const chainStart = calendarEnd.endDate;
    const chainEnd = computeIncrementalChainEnd(
      chainStart,
      settings.periodWeekCount,
      settings.periodsToSchedule,
      settings.weekStartDay,
    );
    const collision = await findCollisionInRange(chainStart, chainEnd, calendarEnd.period.id);
    if (collision) {
      error = collisionErrorMessage(collision);
    } else {
      periods = buildIncrementalPreview(
        chainStart,
        settings.periodWeekCount,
        settings.periodsToSchedule,
        settings.weekStartDay,
        existingCount,
      );
    }
  } else {
    const planAnchor = startOfWeek(settings.periodFirstWeekStart, settings.weekStartDay);
    periods = buildGridPreview(
      planAnchor,
      settings.periodWeekCount,
      settings.periodsToSchedule,
      settings.weekStartDay,
      existingCount,
    );

    for (const period of periods) {
      const overlap = await findOverlappingPeriod(
        parseDateString(period.start_date),
        parseDateString(period.end_date),
      );
      if (overlap) {
        error = `${period.start_date} – ${period.end_date} overlaps "${overlap.name}" (${formatBlockingStatus(overlap.status)}). Fix the anchor date, delete unstarted periods, or use Replace unstarted.`;
        break;
      }
    }
  }

  return {
    generation_mode: mode,
    next_period_start: computeNextPeriodStart(
      lastEnd,
      settings.weekStartDay,
      toDateString(settings.periodFirstWeekStart),
      mode,
    ),
    last_period_end: lastEnd ? toDateString(lastEnd) : null,
    periods,
    would_create: error ? 0 : periods.length,
    requested: settings.periodsToSchedule,
    error,
  };
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
        autoDraftPaused: false,
      },
    }),
  ]);

  return { ok: true, status: "open" as const };
}
