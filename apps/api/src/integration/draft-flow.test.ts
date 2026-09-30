/**
 * Integration tests against PostgreSQL (DATABASE_URL required).
 * CI runs migrate deploy before `pnpm test`.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { canUseSchedulingTools } from "../lib/authority.js";
import { createPeriod, getRotatedDefaultPriorities } from "../services/periods.js";
import {
  confirmPick,
  getDraftState,
  pickWeek,
  processTurnTimeout,
  resumeDraft,
  reviseCompletedPick,
  skipTurn,
  startDraft,
} from "../services/draft.js";
import { assignWeek, getPeriodSwapHistory, publishPeriod, swapWeeks } from "../services/assignments.js";

const prisma = new PrismaClient();
const RUN = !!process.env.DATABASE_URL;

const tag = `int-${Date.now()}`;
let fixtureSeq = 0;

type Fixture = {
  adminId: string;
  households: { id: string; userId: string }[];
  periodId: string;
  weekIds: string[];
};

async function createFixture(): Promise<Fixture> {
  const id = `${tag}-${++fixtureSeq}`;
  const passwordHash = await bcrypt.hash("testpass123", 4);
  const openingAt = new Date(Date.UTC(2020, 0, 1));
  const admin = await prisma.user.create({
    data: {
      email: `${id}-admin@test.com`,
      passwordHash,
      displayName: "Test Admin",
      isAdmin: true,
      emailVerifiedAt: new Date(),
    },
  });

  const households: { id: string; userId: string }[] = [];
  for (let i = 1; i <= 3; i++) {
    const h = await prisma.household.create({
      data: {
        name: `${id}-H${i}`,
        color: "#2563EB",
        isWorkerBee: false,
        authority: i === 1 ? "coordinator" : "active",
      },
    });
    const u = await prisma.user.create({
      data: {
        email: `${id}-u${i}@test.com`,
        passwordHash,
        displayName: `User ${i}`,
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.householdMembership.create({ data: { userId: u.id, householdId: h.id } });
    households.push({ id: h.id, userId: u.id });
  }

  const start = new Date(Date.UTC(2030, 0, 5));
  const end = new Date(Date.UTC(2030, 0, 26));
  const period = await createPeriod({
    name: `${id} period`,
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    opening_at: openingAt.toISOString(),
    created_by_user_id: admin.id,
  });

  await prisma.periodHouseholdPriority.deleteMany({ where: { schedulingPeriodId: period.id } });
  await prisma.periodHouseholdPriority.createMany({
    data: households.map((h, i) => ({
      schedulingPeriodId: period.id,
      householdId: h.id,
      position: i + 1,
    })),
  });

  await prisma.schedulingPeriod.update({
    where: { id: period.id },
    data: { status: "open", openingAt },
  });

  const detail = await prisma.periodWeek.findMany({
    where: { schedulingPeriodId: period.id },
    orderBy: { sortOrder: "asc" },
  });

  return {
    adminId: admin.id,
    households,
    periodId: period.id,
    weekIds: detail.map((w) => w.id),
  };
}

async function cleanupFixture(f: Fixture) {
  const userIds = [f.adminId, ...f.households.map((h) => h.userId)];
  await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.schedulingPeriod.deleteMany({ where: { id: f.periodId } });
  for (const h of f.households) {
    await prisma.user.deleteMany({ where: { id: h.userId } });
    await prisma.household.deleteMany({ where: { id: h.id } });
  }
  await prisma.user.deleteMany({ where: { id: f.adminId } });
}

async function advanceTurnWithPick(
  f: Fixture,
  householdIndex: number,
  weekIndex: number,
) {
  const draft = await getDraftState(f.periodId);
  const turn = draft.active_turn;
  assert.ok(turn, "expected active turn");
  const hh = f.households[householdIndex]!;
  assert.equal(turn.household_id, hh.id);
  await pickWeek(turn.id, f.weekIds[weekIndex]!, hh.userId, hh.id);
  await confirmPick(turn.id, hh.userId, hh.id);
}

describe("draft integration", { skip: !RUN }, () => {
  let fixture: Fixture;

  before(async () => {
    fixture = await createFixture();
  });

  after(async () => {
    await cleanupFixture(fixture);
    await prisma.$disconnect();
  });

  it("three households pick without double-booking and reaches assignment", async () => {
    await startDraft(fixture.periodId);
    await advanceTurnWithPick(fixture, 0, 0);
    await advanceTurnWithPick(fixture, 1, 1);
    await advanceTurnWithPick(fixture, 2, 2);

    const period = await prisma.schedulingPeriod.findUniqueOrThrow({
      where: { id: fixture.periodId },
    });
    assert.equal(period.status, "assignment");

    const assignments = await prisma.assignment.findMany({
      where: { schedulingPeriodId: fixture.periodId },
    });
    assert.equal(assignments.length, 3);
    const weekIds = new Set(assignments.map((a) => a.periodWeekId));
    assert.equal(weekIds.size, 3);
  });

  it("two consecutive auto-skips trigger hold then resume", async () => {
    const f2 = await createFixture();
    try {
      await startDraft(f2.periodId);
      let draft = await getDraftState(f2.periodId);
      let turn = draft.active_turn!;
      await prisma.draftTurn.update({
        where: { id: turn.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await processTurnTimeout(turn.id);

      draft = await getDraftState(f2.periodId);
      turn = draft.active_turn!;
      await prisma.draftTurn.update({
        where: { id: turn.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await processTurnTimeout(turn.id);

      const period = await prisma.schedulingPeriod.findUniqueOrThrow({
        where: { id: f2.periodId },
      });
      assert.equal(period.draftOnHold, true);

      await resumeDraft(f2.periodId, true);
      draft = await getDraftState(f2.periodId);
      assert.ok(draft.active_turn, "draft resumes with active turn after hold");
    } finally {
      await cleanupFixture(f2);
    }
  });

  it("published reassign creates audit event", async () => {
    const f3 = await createFixture();
    try {
      await startDraft(f3.periodId);
      for (let i = 0; i < 3; i++) {
        await advanceTurnWithPick(f3, i, i);
      }

      const unassigned = await prisma.periodWeek.findMany({
        where: { schedulingPeriodId: f3.periodId, assignment: null },
      });
      for (const w of unassigned) {
        await assignWeek(f3.periodId, w.id, f3.households[0]!.id, f3.adminId);
      }

      await publishPeriod(f3.periodId, f3.adminId);

      const week = await prisma.periodWeek.findFirstOrThrow({
        where: { schedulingPeriodId: f3.periodId },
        include: { assignment: true },
      });
      assert.ok(week.assignment);

      const targetHousehold = f3.households[1]!.id;
      await assignWeek(
        f3.periodId,
        week.id,
        targetHousehold,
        f3.adminId,
        "Integration test swap",
      );

      const audit = await prisma.auditEvent.findFirst({
        where: {
          eventType: "assignment_changed",
          entityType: "assignment",
        },
        orderBy: { createdAt: "desc" },
      });
      assert.ok(audit);
      assert.equal(audit.reason, "Integration test swap");
    } finally {
      await cleanupFixture(f3);
    }
  });

  it("member can swap published weeks with reason and audit", async () => {
    const f4 = await createFixture();
    try {
      await startDraft(f4.periodId);
      for (let i = 0; i < 3; i++) {
        await advanceTurnWithPick(f4, i, i);
      }
      const unassigned = await prisma.periodWeek.findMany({
        where: { schedulingPeriodId: f4.periodId, assignment: null },
      });
      for (const w of unassigned) {
        await assignWeek(f4.periodId, w.id, f4.households[0]!.id, f4.adminId);
      }
      await publishPeriod(f4.periodId, f4.adminId);

      const weeks = await prisma.periodWeek.findMany({
        where: { schedulingPeriodId: f4.periodId, assignment: { isNot: null } },
        include: { assignment: true },
        orderBy: { sortOrder: "asc" },
      });
      assert.ok(weeks.length >= 2);
      const member = f4.households[1]!;

      await assert.rejects(
        () =>
          swapWeeks(
            f4.periodId,
            weeks[0]!.id,
            weeks[1]!.id,
            member.userId,
            "Member",
            false,
            member.id,
            undefined,
            undefined,
            "",
          ),
        (err: Error) => err.message.includes("Reason is required"),
      );

      await swapWeeks(
        f4.periodId,
        weeks[0]!.id,
        weeks[1]!.id,
        member.userId,
        "Member User",
        false,
        member.id,
        undefined,
        undefined,
        "Agreed trade",
      );

      const a0 = await prisma.assignment.findUniqueOrThrow({
        where: { periodWeekId: weeks[0]!.id },
      });
      assert.equal(a0.source, "household_swap");

      const history = await getPeriodSwapHistory(f4.periodId);
      assert.equal(history.swaps.length, 1);
      assert.equal(history.swaps[0]!.reason, "Agreed trade");
    } finally {
      await cleanupFixture(f4);
    }
  });

  it("coordinator swap during assignment sets household_swap source", async () => {
    const f5 = await createFixture();
    try {
      await startDraft(f5.periodId);
      for (let i = 0; i < 3; i++) {
        await advanceTurnWithPick(f5, i, i);
      }
      const weeks = await prisma.periodWeek.findMany({
        where: { schedulingPeriodId: f5.periodId, assignment: { isNot: null } },
        orderBy: { sortOrder: "asc" },
      });
      assert.ok(weeks.length >= 2);

      await swapWeeks(
        f5.periodId,
        weeks[0]!.id,
        weeks[1]!.id,
        f5.adminId,
        "Coordinator",
        true,
        f5.households[0]!.id,
        undefined,
        undefined,
        "Coordinator swap in assignment",
      );

      const a0 = await prisma.assignment.findUniqueOrThrow({
        where: { periodWeekId: weeks[0]!.id },
      });
      assert.equal(a0.source, "household_swap");
    } finally {
      await cleanupFixture(f5);
    }
  });

  it("Worker Bee is excluded from turns; coordinator can assign in assignment phase", async () => {
    const f = await createFixture();
    const wb = await prisma.household.create({
      data: {
        name: `${tag}-wb-${Date.now()}-WorkerBee`,
        color: "#64748B",
        isWorkerBee: true,
        authority: "active",
      },
    });
    try {
      await prisma.periodHouseholdPriority.create({
        data: {
          schedulingPeriodId: f.periodId,
          householdId: wb.id,
          position: 99,
        },
      });

      await startDraft(f.periodId);
      const draft = await getDraftState(f.periodId);
      assert.ok(!draft.turns.some((t) => t.household_id === wb.id));
      assert.ok(draft.active_turn);
      assert.notEqual(draft.active_turn.household_id, wb.id);

      for (let i = 0; i < 3; i++) {
        await advanceTurnWithPick(f, i, i);
      }

      const period = await prisma.schedulingPeriod.findUniqueOrThrow({
        where: { id: f.periodId },
      });
      assert.equal(period.status, "assignment");

      const openWeek = await prisma.periodWeek.findFirstOrThrow({
        where: { schedulingPeriodId: f.periodId, assignment: null },
      });
      await assignWeek(f.periodId, openWeek.id, wb.id, f.adminId);

      const assignment = await prisma.assignment.findUniqueOrThrow({
        where: { periodWeekId: openWeek.id },
      });
      assert.equal(assignment.householdId, wb.id);
      assert.equal(assignment.source, "coordinator_manual");
    } finally {
      await prisma.periodHouseholdPriority.deleteMany({ where: { householdId: wb.id } });
      await prisma.assignment.deleteMany({ where: { householdId: wb.id } });
      await prisma.household.deleteMany({ where: { id: wb.id } });
      await cleanupFixture(f);
    }
  });

  it("wrong household cannot pick on another's turn", async () => {
    const f = await createFixture();
    try {
      await startDraft(f.periodId);
      const draft = await getDraftState(f.periodId);
      const turn = draft.active_turn!;
      assert.equal(turn.household_id, f.households[0]!.id);
      const other = f.households[1]!;

      await assert.rejects(
        () => pickWeek(turn.id, f.weekIds[0]!, other.userId, other.id),
        (err: unknown) =>
          err instanceof AppError && err.statusCode === 403 && err.code === "forbidden",
      );
    } finally {
      await cleanupFixture(f);
    }
  });

  it("voluntary skip advances turn and leaves week unassigned", async () => {
    const f = await createFixture();
    try {
      await startDraft(f.periodId);
      let draft = await getDraftState(f.periodId);
      const turn = draft.active_turn!;
      const skipper = f.households[0]!;
      assert.equal(turn.household_id, skipper.id);

      await skipTurn(turn.id, skipper.userId, skipper.id);

      draft = await getDraftState(f.periodId);
      assert.ok(draft.active_turn);
      assert.equal(draft.active_turn.household_id, f.households[1]!.id);

      const skippedTurn = await prisma.draftTurn.findUniqueOrThrow({ where: { id: turn.id } });
      assert.equal(skippedTurn.status, "completed");
      assert.equal(skippedTurn.action, "skip");
      assert.equal(skippedTurn.periodWeekId, null);

      const assignments = await prisma.assignment.findMany({
        where: { schedulingPeriodId: f.periodId },
      });
      assert.equal(assignments.length, 0);
    } finally {
      await cleanupFixture(f);
    }
  });

  it("revise completed pick during draft; reject after draft ends", async () => {
    const f = await createFixture();
    try {
      assert.ok(f.weekIds.length >= 2, "fixture needs at least two weeks");
      await startDraft(f.periodId);
      await advanceTurnWithPick(f, 0, 0);

      const completed = await prisma.draftTurn.findFirstOrThrow({
        where: {
          schedulingPeriodId: f.periodId,
          householdId: f.households[0]!.id,
          status: "completed",
          action: "pick",
        },
      });
      assert.equal(completed.periodWeekId, f.weekIds[0]!);

      const openWeekId = f.weekIds[1]!;
      await reviseCompletedPick(
        completed.id,
        f.households[0]!.userId,
        f.households[0]!.id,
        false,
        openWeekId,
      );

      const revised = await prisma.draftTurn.findUniqueOrThrow({ where: { id: completed.id } });
      assert.equal(revised.periodWeekId, openWeekId);
      const oldAssignment = await prisma.assignment.findUnique({
        where: { periodWeekId: f.weekIds[0]! },
      });
      assert.equal(oldAssignment, null);
      const newAssignment = await prisma.assignment.findUniqueOrThrow({
        where: { periodWeekId: openWeekId },
      });
      assert.equal(newAssignment.householdId, f.households[0]!.id);

      await prisma.schedulingPeriod.update({
        where: { id: f.periodId },
        data: { status: "assignment" },
      });

      await assert.rejects(
        () =>
          reviseCompletedPick(
            completed.id,
            f.households[0]!.userId,
            f.households[0]!.id,
            false,
            f.weekIds[0]!,
          ),
        (err: unknown) =>
          err instanceof AppError && err.statusCode === 422 && err.code === "invalid_state",
      );
    } finally {
      await cleanupFixture(f);
    }
  });

  it("double-book rejected when second household picks an assigned week", async () => {
    const f = await createFixture();
    try {
      await startDraft(f.periodId);
      await advanceTurnWithPick(f, 0, 0);

      const draft = await getDraftState(f.periodId);
      const turn = draft.active_turn!;
      assert.equal(turn.household_id, f.households[1]!.id);

      await assert.rejects(
        () =>
          pickWeek(turn.id, f.weekIds[0]!, f.households[1]!.userId, f.households[1]!.id),
        (err: unknown) =>
          err instanceof AppError && err.statusCode === 409 && err.code === "week_taken",
      );
    } finally {
      await cleanupFixture(f);
    }
  });

  it("priority rotation E2E — next period defaults with last of previous first", async () => {
    const f = await createFixture();
    let periodAId: string | null = null;
    let periodBId: string | null = null;
    try {
      // Isolated far-future window; clear leftovers from prior runs in that range.
      await prisma.schedulingPeriod.deleteMany({
        where: { startDate: { gte: new Date(Date.UTC(2099, 0, 1)) } },
      });

      const periodA = await createPeriod({
        name: `${tag} rotation-a-${Date.now()}`,
        start_date: "2099-06-06",
        end_date: "2099-06-27",
        opening_at: new Date(Date.UTC(2020, 0, 1)).toISOString(),
        created_by_user_id: f.adminId,
      });
      periodAId = periodA.id;

      await prisma.periodHouseholdPriority.deleteMany({
        where: { schedulingPeriodId: periodAId },
      });
      await prisma.periodHouseholdPriority.createMany({
        data: f.households.map((h, i) => ({
          schedulingPeriodId: periodAId!,
          householdId: h.id,
          position: i + 1,
        })),
      });

      // Start B after A's window so week-aligned bounds still treat A as predecessor.
      const periodB = await createPeriod({
        name: `${tag} rotation-b-${Date.now()}`,
        start_date: "2099-07-04",
        end_date: "2099-07-25",
        opening_at: new Date(Date.UTC(2020, 0, 1)).toISOString(),
        created_by_user_id: f.adminId,
      });
      periodBId = periodB.id;

      const defaults = await getRotatedDefaultPriorities(periodBId);
      assert.equal(defaults[0]?.household_id, f.households[2]!.id);

      const stored = await prisma.periodHouseholdPriority.findMany({
        where: { schedulingPeriodId: periodBId },
        orderBy: { position: "asc" },
      });
      assert.equal(stored[0]?.householdId, f.households[2]!.id);
      assert.equal(stored[1]?.householdId, f.households[0]!.id);
      assert.equal(stored[2]?.householdId, f.households[1]!.id);
    } finally {
      if (periodBId) {
        await prisma.schedulingPeriod.deleteMany({ where: { id: periodBId } });
      }
      if (periodAId) {
        await prisma.schedulingPeriod.deleteMany({ where: { id: periodAId } });
      }
      await cleanupFixture(f);
    }
  });

  it("authority gates — active cannot use scheduling tools; coordinator household can", () => {
    const active = canUseSchedulingTools({
      isAdmin: false,
      schedulingToolsEnabled: true,
      household: { authority: "active", isWorkerBee: false },
    });
    const coordinator = canUseSchedulingTools({
      isAdmin: false,
      schedulingToolsEnabled: true,
      household: { authority: "coordinator", isWorkerBee: false },
    });
    assert.equal(active, false);
    assert.equal(coordinator, true);
  });
});
