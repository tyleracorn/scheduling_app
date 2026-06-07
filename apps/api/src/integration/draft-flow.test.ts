/**
 * Integration tests against PostgreSQL (DATABASE_URL required).
 * CI runs migrate deploy before `pnpm test`.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { createPeriod } from "../services/periods.js";
import {
  confirmPick,
  getDraftState,
  pickWeek,
  processTurnTimeout,
  resumeDraft,
  startDraft,
} from "../services/draft.js";
import { assignWeek, publishPeriod } from "../services/assignments.js";

const prisma = new PrismaClient();
const RUN = !!process.env.DATABASE_URL;

const tag = `int-${Date.now()}`;

type Fixture = {
  adminId: string;
  households: { id: string; userId: string }[];
  periodId: string;
  weekIds: string[];
};

async function createFixture(): Promise<Fixture> {
  const passwordHash = await bcrypt.hash("testpass123", 4);
  const admin = await prisma.user.create({
    data: {
      email: `${tag}-admin@test.com`,
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
        name: `${tag}-H${i}`,
        color: "#2563EB",
        isWorkerBee: false,
        isCoordinator: i === 1,
      },
    });
    const u = await prisma.user.create({
      data: {
        email: `${tag}-u${i}@test.com`,
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
    name: `${tag} period`,
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    opening_at: new Date(Date.UTC(2029, 11, 1)).toISOString(),
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
    data: { status: "open", openingAt: new Date(Date.UTC(2029, 11, 1)) },
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
});
