import type { DraftTurnAction } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { toDateString } from "../lib/dates.js";
import { getSystemSettings } from "./periods.js";
import { notifyAllUsers, notifyCoordinators, notifyHousehold } from "./notifications.js";

const MS_PER_HOUR = 60 * 60 * 1000;

export async function getDraftState(periodId: string) {
  const period = await prisma.schedulingPeriod.findUnique({
    where: { id: periodId },
    include: {
      priorities: { orderBy: { position: "asc" }, include: { household: true } },
      weeks: { orderBy: { sortOrder: "asc" }, include: { assignment: true } },
      draftTurns: { orderBy: [{ round: "asc" }, { positionInRound: "asc" }] },
    },
  });
  if (!period) throw new AppError(404, "not_found", "Period not found");

  const settings = await getSystemSettings();
  const activeTurn = period.draftTurns.find((t) => t.status === "active");

  const assignedWeekIds = new Set(
    period.weeks.filter((w) => w.assignment).map((w) => w.id),
  );
  const available_weeks = period.weeks
    .filter((w) => !assignedWeekIds.has(w.id))
    .map((w) => ({
      period_week_id: w.id,
      week_start_date: toDateString(w.weekStartDate),
      week_end_date: toDateString(w.weekEndDate),
    }));

  return {
    period_id: period.id,
    period_name: period.name,
    status: period.status,
    on_hold: period.draftOnHold,
    consecutive_auto_skips: period.consecutiveAutoSkips,
    current_round: period.currentRound,
    max_rounds: settings.weekSelectionsPerHousehold,
    active_turn: activeTurn
      ? {
          id: activeTurn.id,
          household_id: activeTurn.householdId,
          household_name:
            period.priorities.find((p) => p.householdId === activeTurn.householdId)?.household
              .name ?? "",
          expires_at: activeTurn.expiresAt?.toISOString() ?? null,
          round: activeTurn.round,
        }
      : null,
    available_weeks,
    turns: period.draftTurns.map((t) => ({
      id: t.id,
      round: t.round,
      household_id: t.householdId,
      status: t.status,
      action: t.action,
      period_week_id: t.periodWeekId,
    })),
  };
}

async function getActiveHouseholdIds(periodId: string): Promise<string[]> {
  const rows = await prisma.periodHouseholdPriority.findMany({
    where: { schedulingPeriodId: periodId, household: { active: true } },
    orderBy: { position: "asc" },
  });
  return rows.map((r) => r.householdId);
}

async function householdCompletedInRound(
  periodId: string,
  round: number,
  householdId: string,
): Promise<boolean> {
  const turn = await prisma.draftTurn.findFirst({
    where: {
      schedulingPeriodId: periodId,
      round,
      householdId,
      status: "completed",
    },
  });
  return !!turn;
}

export async function activateNextTurn(periodId: string): Promise<void> {
  const period = await prisma.schedulingPeriod.findUnique({ where: { id: periodId } });
  if (!period || period.status !== "draft") return;
  if (period.draftOnHold) return;

  const settings = await getSystemSettings();
  const maxRounds = settings.weekSelectionsPerHousehold;
  let round = period.currentRound;

  while (round <= maxRounds) {
    const priorities = await prisma.periodHouseholdPriority.findMany({
      where: { schedulingPeriodId: periodId, household: { active: true } },
      orderBy: { position: "asc" },
      include: { household: true },
    });

    for (const p of priorities) {
      const done = await householdCompletedInRound(periodId, round, p.householdId);
      if (done) continue;

      const startedAt = new Date();
      const expiresAt = new Date(
        startedAt.getTime() + settings.pickWindowHours * MS_PER_HOUR,
      );

      await prisma.draftTurn.create({
        data: {
          schedulingPeriodId: periodId,
          householdId: p.householdId,
          round,
          positionInRound: p.position,
          status: "active",
          startedAt,
          expiresAt,
        },
      });

      await prisma.schedulingPeriod.update({
        where: { id: periodId },
        data: { currentRound: round },
      });

      await notifyHousehold(
        p.householdId,
        "your_turn",
        "Your turn to pick a week",
        `It's ${p.household.name}'s turn in ${period.name}. Pick or skip before the deadline.`,
        { period_id: periodId },
      );
      return;
    }

    round += 1;
    await prisma.schedulingPeriod.update({
      where: { id: periodId },
      data: { currentRound: round },
    });
  }

  await prisma.schedulingPeriod.update({
    where: { id: periodId },
    data: { status: "assignment", currentRound: maxRounds },
  });
  await notifyCoordinators(
    "assignment_phase_started",
    "Draft complete — assign remaining weeks",
    `${period.name}: all households have picked. Assign any remaining weeks.`,
    { period_id: periodId },
  );
}

async function completeTurn(
  turnId: string,
  action: DraftTurnAction,
  actedByUserId: string | null,
  periodWeekId: string | null,
  autoSkip: boolean,
) {
  const turn = await prisma.draftTurn.findUnique({
    where: { id: turnId },
    include: { period: true },
  });
  if (!turn || turn.status !== "active") {
    throw new AppError(410, "turn_inactive", "This turn is no longer active");
  }

  const periodId = turn.schedulingPeriodId;

  if (action === "pick" && periodWeekId) {
    const existing = await prisma.assignment.findUnique({
      where: { periodWeekId },
    });
    if (existing && existing.draftTurnId !== turnId) {
      throw new AppError(409, "week_taken", "That week is already assigned");
    }
    await prisma.assignment.upsert({
      where: { periodWeekId },
      create: {
        schedulingPeriodId: periodId,
        periodWeekId,
        householdId: turn.householdId,
        source: "draft_pick",
        draftTurnId: turnId,
      },
      update: {
        householdId: turn.householdId,
        source: "draft_pick",
        draftTurnId: turnId,
      },
    });
  }

  await prisma.draftTurn.update({
    where: { id: turnId },
    data: {
      status: "completed",
      action,
      actedByUserId,
      periodWeekId: action === "pick" ? periodWeekId : null,
      completedAt: new Date(),
    },
  });

  let consecutive = turn.period.consecutiveAutoSkips;
  if (autoSkip) {
    consecutive += 1;
  } else if (action !== "auto_skip") {
    consecutive = 0;
  }

  const onHold = consecutive >= 2;

  await prisma.schedulingPeriod.update({
    where: { id: periodId },
    data: {
      consecutiveAutoSkips: consecutive,
      draftOnHold: onHold,
    },
  });

  if (onHold) {
    await notifyCoordinators(
      "draft_on_hold",
      "Draft on hold",
      `${turn.period.name}: two consecutive auto-skips. Coordinator action needed.`,
      { period_id: periodId },
    );
    return;
  }

  await activateNextTurn(periodId);
}

export async function startDraft(periodId: string) {
  const period = await prisma.schedulingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new AppError(404, "not_found", "Period not found");
  if (period.status !== "open") {
    throw new AppError(422, "invalid_state", "Draft can only start from an open period");
  }
  if (period.openingAt > new Date()) {
    throw new AppError(422, "not_open_yet", "Opening date has not passed yet");
  }

  const householdIds = await getActiveHouseholdIds(periodId);
  if (householdIds.length === 0) {
    throw new AppError(422, "no_households", "No active households in priority list");
  }

  await prisma.schedulingPeriod.update({
    where: { id: periodId },
    data: {
      status: "draft",
      draftStartedAt: new Date(),
      currentRound: 1,
      consecutiveAutoSkips: 0,
      draftOnHold: false,
    },
  });

  await notifyAllUsers(
    "draft_started",
    "Draft started",
    `Scheduling draft for ${period.name} has begun.`,
    { period_id: periodId },
  );
  await activateNextTurn(periodId);
  return getDraftState(periodId);
}

export async function pickWeek(
  turnId: string,
  periodWeekId: string,
  userId: string,
  householdId: string,
) {
  const turn = await prisma.draftTurn.findUnique({ where: { id: turnId } });
  if (!turn || turn.status !== "active") {
    throw new AppError(410, "turn_inactive", "This turn is no longer active");
  }
  if (turn.householdId !== householdId) {
    throw new AppError(403, "forbidden", "Not your household's turn");
  }

  const week = await prisma.periodWeek.findFirst({
    where: { id: periodWeekId, schedulingPeriodId: turn.schedulingPeriodId },
  });
  if (!week) throw new AppError(404, "not_found", "Week not found in this period");

  await completeTurn(turnId, "pick", userId, periodWeekId, false);
  return getDraftState(turn.schedulingPeriodId);
}

export async function skipTurn(turnId: string, userId: string, householdId: string) {
  const turn = await prisma.draftTurn.findUnique({ where: { id: turnId } });
  if (!turn || turn.status !== "active") {
    throw new AppError(410, "turn_inactive", "This turn is no longer active");
  }
  if (turn.householdId !== householdId) {
    throw new AppError(403, "forbidden", "Not your household's turn");
  }
  await completeTurn(turnId, "skip", userId, null, false);
  return getDraftState(turn.schedulingPeriodId);
}

export async function changePick(
  turnId: string,
  periodWeekId: string,
  userId: string,
  householdId: string,
) {
  const turn = await prisma.draftTurn.findUnique({ where: { id: turnId } });
  if (!turn || turn.status !== "active") {
    throw new AppError(410, "turn_inactive", "This turn is no longer active");
  }
  if (turn.householdId !== householdId) {
    throw new AppError(403, "forbidden", "Not your household's turn");
  }

  const existing = await prisma.assignment.findUnique({ where: { periodWeekId } });
  if (existing && existing.draftTurnId !== turnId) {
    throw new AppError(409, "week_taken", "That week is already assigned");
  }

  await prisma.assignment.upsert({
    where: { periodWeekId },
    create: {
      schedulingPeriodId: turn.schedulingPeriodId,
      periodWeekId,
      householdId: turn.householdId,
      source: "draft_pick",
      draftTurnId: turnId,
    },
    update: {
      householdId: turn.householdId,
      draftTurnId: turnId,
    },
  });

  await prisma.draftTurn.update({
    where: { id: turnId },
    data: { periodWeekId, actedByUserId: userId },
  });

  return getDraftState(turn.schedulingPeriodId);
}

export async function processTurnTimeout(turnId: string) {
  const turn = await prisma.draftTurn.findUnique({
    where: { id: turnId },
    include: { period: true, household: true },
  });
  if (!turn || turn.status !== "active") return;
  if (turn.expiresAt && turn.expiresAt > new Date()) return;

  await completeTurn(turnId, "auto_skip", null, null, true);
}

export async function resumeDraft(periodId: string, resetCounter: boolean) {
  const period = await prisma.schedulingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw new AppError(404, "not_found", "Period not found");
  if (period.status !== "draft") {
    throw new AppError(422, "invalid_state", "Period is not in draft");
  }
  if (!period.draftOnHold) {
    throw new AppError(422, "not_on_hold", "Draft is not on hold");
  }

  await prisma.schedulingPeriod.update({
    where: { id: periodId },
    data: {
      draftOnHold: false,
      consecutiveAutoSkips: resetCounter ? 0 : 1,
    },
  });

  await activateNextTurn(periodId);
  return getDraftState(periodId);
}

export async function coordinatorForceSkip(turnId: string, coordinatorId: string) {
  const turn = await prisma.draftTurn.findUnique({ where: { id: turnId } });
  if (!turn || turn.status !== "active") {
    throw new AppError(410, "turn_inactive", "No active turn");
  }
  await completeTurn(turnId, "coordinator_skip", coordinatorId, null, false);
  await prisma.schedulingPeriod.update({
    where: { id: turn.schedulingPeriodId },
    data: { draftOnHold: false, consecutiveAutoSkips: 0 },
  });
  return getDraftState(turn.schedulingPeriodId);
}

export async function coordinatorPickFor(
  turnId: string,
  periodWeekId: string,
  coordinatorId: string,
) {
  const turn = await prisma.draftTurn.findUnique({ where: { id: turnId } });
  if (!turn || turn.status !== "active") {
    throw new AppError(410, "turn_inactive", "No active turn");
  }
  await completeTurn(turnId, "coordinator_pick", coordinatorId, periodWeekId, false);
  await prisma.schedulingPeriod.update({
    where: { id: turn.schedulingPeriodId },
    data: { draftOnHold: false, consecutiveAutoSkips: 0 },
  });
  return getDraftState(turn.schedulingPeriodId);
}

export async function openDuePeriods() {
  const due = await prisma.schedulingPeriod.findMany({
    where: { status: "scheduled", openingAt: { lte: new Date() } },
  });
  for (const p of due) {
    await prisma.schedulingPeriod.update({
      where: { id: p.id },
      data: { status: "open" },
    });
    await notifyAllUsers(
      "period_opened",
      "Scheduling period open",
      `${p.name} is now open for notes and planning.`,
      { period_id: p.id },
    );
  }
}

export async function processExpiredTurns() {
  const expired = await prisma.draftTurn.findMany({
    where: { status: "active", expiresAt: { lte: new Date() } },
  });
  for (const t of expired) {
    await processTurnTimeout(t.id);
  }
}
