import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { computePeriodWeeks } from "../dist/lib/period-weeks.js";

const prisma = new PrismaClient();

const HOUSEHOLDS = [
  { name: "Household 1", shortCode: "H1", color: "#2563EB" },
  { name: "Household 2", shortCode: "H2", color: "#DC2626" },
  { name: "Household 3", shortCode: "H3", color: "#16A34A" },
  { name: "Household 4", shortCode: "H4", color: "#CA8A04" },
  { name: "Household 5", shortCode: "H5", color: "#9333EA" },
];

function envFlag(name: string): boolean {
  const value = process.env[name]?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/**
 * Drop default "Household N" rows recreated by an older seed after the real
 * households were renamed. Only when the cabin already has a full set of
 * renamed households, and the default row has no members, invites, assignments,
 * or an active draft turn.
 */
async function removeReseededDefaultHouseholds() {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
  const slotCount = settings?.householdSlotCount ?? HOUSEHOLDS.length;
  const defaultNames = new Set(HOUSEHOLDS.map((h) => h.name));
  const owning = await prisma.household.findMany({
    where: { isWorkerBee: false },
    include: {
      memberships: { select: { id: true } },
      assignments: { select: { id: true } },
      invites: { select: { id: true } },
      draftTurns: { select: { status: true } },
    },
  });
  const customCount = owning.filter((h) => !defaultNames.has(h.name)).length;
  const removed: string[] = [];
  const skipped: { name: string; reason: string }[] = [];

  if (customCount >= slotCount) {
    for (const household of owning) {
      const seeded = HOUSEHOLDS.find(
        (d) => d.name === household.name && d.shortCode === household.shortCode,
      );
      if (!seeded) continue;
      if (household.memberships.length > 0) {
        skipped.push({ name: household.name, reason: "has members" });
        continue;
      }
      if (household.assignments.length > 0) {
        skipped.push({ name: household.name, reason: "has assignments" });
        continue;
      }
      if (household.invites.length > 0) {
        skipped.push({ name: household.name, reason: "has invites" });
        continue;
      }
      if (household.draftTurns.some((turn) => turn.status === "active")) {
        skipped.push({ name: household.name, reason: "active draft turn" });
        continue;
      }

      const priorities = await prisma.periodHouseholdPriority.findMany({
        where: { householdId: household.id },
        select: { schedulingPeriodId: true },
      });
      const periodIds = [...new Set(priorities.map((row) => row.schedulingPeriodId))];
      await prisma.draftTurn.deleteMany({ where: { householdId: household.id } });
      await prisma.periodHouseholdPriority.deleteMany({ where: { householdId: household.id } });
      for (const periodId of periodIds) {
        const rows = await prisma.periodHouseholdPriority.findMany({
          where: { schedulingPeriodId: periodId },
          orderBy: { position: "asc" },
        });
        for (const row of rows) {
          await prisma.periodHouseholdPriority.update({
            where: { id: row.id },
            data: { position: row.position + 1000 },
          });
        }
        for (let i = 0; i < rows.length; i++) {
          await prisma.periodHouseholdPriority.update({
            where: { id: rows[i]!.id },
            data: { position: i + 1 },
          });
        }
      }
      await prisma.household.delete({ where: { id: household.id } });
      removed.push(household.name);
    }
  }

  if (removed.length > 0) {
    console.info(`Removed reseeded default households: ${removed.join(", ")}`);
  }
  if (skipped.length > 0) {
    console.info(
      `Left default households in place: ${skipped.map((row) => `${row.name} (${row.reason})`).join(", ")}`,
    );
  }
}

/** Idempotent bootstrap: settings, households, admin. Safe to run on every container start. */
async function seedBootstrap() {
  await prisma.systemSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      cabinTimezone: "America/Denver",
      weekStartDay: 0,
      weekSelectionsPerHousehold: 1,
      pickWindowHours: 72,
      pickWarningLeadHours: 24,
      historyRetentionYears: 3,
      periodWeekCount: 13,
      openLeadDays: 30,
      periodsToSchedule: 4,
      householdSlotCount: 5,
      draftStartLeadDays: 0,
      maxCoordinatorHouseholds: 3,
    },
    update: {},
  });

  const owningBeforeSeed = await prisma.household.count({ where: { isWorkerBee: false } });
  for (const h of HOUSEHOLDS) {
    const existing = await prisma.household.findFirst({ where: { name: h.name } });
    if (owningBeforeSeed === 0 && !existing) {
      await prisma.household.create({ data: { ...h, isWorkerBee: false } });
    }
  }
  await removeReseededDefaultHouseholds();

  const workerBee = await prisma.household.findFirst({ where: { isWorkerBee: true } });
  if (!workerBee) {
    await prisma.household.create({
      data: {
        name: "Worker Bee",
        shortCode: "WOR",
        color: "#64748B",
        active: true,
        isWorkerBee: true,
      },
    });
  }

  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme";
  const passwordHash = await bcrypt.hash(password, 12);
  const forcePassword = envFlag("FORCE_SEED_PASSWORD");

  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  const admin = existingAdmin
    ? await prisma.user.update({
        where: { email },
        data: {
          isAdmin: true,
          active: true,
          ...(forcePassword ? { passwordHash } : {}),
        },
      })
    : await prisma.user.create({
        data: {
          email,
          passwordHash,
          displayName: "Administrator",
          isAdmin: true,
          emailVerifiedAt: new Date(),
        },
      });

  const firstHousehold = await prisma.household.findFirst({
    where: { isWorkerBee: false },
    orderBy: { name: "asc" },
  });
  if (firstHousehold) {
    const hasCoordinator = await prisma.household.findFirst({
      where: { authority: "coordinator" },
    });
    if (!hasCoordinator) {
      await prisma.household.update({
        where: { id: firstHousehold.id },
        data: { authority: "coordinator" },
      });
    }

    const membership = await prisma.householdMembership.findUnique({ where: { userId: admin.id } });
    if (!membership) {
      await prisma.householdMembership.create({
        data: { userId: admin.id, householdId: firstHousehold.id },
      });
    }
  }

  return admin;
}

async function seedDemoCalendar(adminUserId: string) {
  const existing = await prisma.schedulingPeriod.findFirst({
    where: { name: "Demo calendar period" },
  });
  if (existing) {
    await prisma.assignment.deleteMany({ where: { schedulingPeriodId: existing.id } });
    await prisma.periodWeek.deleteMany({ where: { schedulingPeriodId: existing.id } });
    await prisma.schedulingPeriod.delete({ where: { id: existing.id } });
  }

  const settings = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
  const households = await prisma.household.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });
  if (households.length === 0) return;

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const periodStart = new Date(Date.UTC(year, month, 1));
  const periodEnd = new Date(Date.UTC(year, month + 3, 0));

  const period = await prisma.schedulingPeriod.create({
    data: {
      name: "Demo calendar period",
      startDate: periodStart,
      endDate: periodEnd,
      openingAt: new Date(Date.UTC(year, month - 1, 15, 14, 0, 0)),
      status: "published",
      publishedAt: new Date(),
      createdByUserId: adminUserId,
    },
  });

  const weekRows = computePeriodWeeks(periodStart, periodEnd, settings.weekStartDay);
  for (let i = 0; i < weekRows.length; i++) {
    const row = weekRows[i];
    const pw = await prisma.periodWeek.create({
      data: {
        schedulingPeriodId: period.id,
        weekStartDate: row.weekStartDate,
        weekEndDate: row.weekEndDate,
        sortOrder: row.sortOrder,
      },
    });
    const household = households[i % households.length];
    await prisma.assignment.create({
      data: {
        schedulingPeriodId: period.id,
        periodWeekId: pw.id,
        householdId: household.id,
        source: "coordinator_manual",
      },
    });
  }

  const nextStart = new Date(Date.UTC(year, month + 4, 1));
  const nextEnd = new Date(Date.UTC(year, month + 7, 0));
  const upcoming = await prisma.schedulingPeriod.findFirst({
    where: { name: "Upcoming scheduling period" },
  });
  if (upcoming) {
    await prisma.schedulingPeriod.delete({ where: { id: upcoming.id } });
  }
  const upcomingPeriod = await prisma.schedulingPeriod.create({
    data: {
      name: "Upcoming scheduling period",
      startDate: nextStart,
      endDate: nextEnd,
      openingAt: new Date(),
      status: "open",
      createdByUserId: adminUserId,
    },
  });
  const upcomingWeeks = computePeriodWeeks(nextStart, nextEnd, settings.weekStartDay);
  await prisma.periodWeek.createMany({
    data: upcomingWeeks.map((r) => ({
      schedulingPeriodId: upcomingPeriod.id,
      weekStartDate: r.weekStartDate,
      weekEndDate: r.weekEndDate,
      sortOrder: r.sortOrder,
    })),
  });
  await prisma.periodHouseholdPriority.createMany({
    data: households.map((h, i) => ({
      schedulingPeriodId: upcomingPeriod.id,
      householdId: h.id,
      position: i + 1,
    })),
  });

  await seedDemoNotesAndOccupancy(adminUserId, households, year, month);
}

async function seedDemoNotesAndOccupancy(
  adminUserId: string,
  households: { id: string; name: string }[],
  year: number,
  month: number,
) {
  const sampleStart = new Date(Date.UTC(year, month, 10));
  const sampleEnd = new Date(Date.UTC(year, month, 16));

  await prisma.calendarNote.deleteMany({
    where: { body: { startsWith: "[demo]" } },
  });

  if (households[1]) {
    await prisma.calendarNote.create({
      data: {
        householdId: households[1].id,
        startDate: sampleStart,
        endDate: sampleEnd,
        body: "[demo] Flexible this week if possible.",
        createdByUserId: adminUserId,
      },
    });
  }
  if (households[0]) {
    await prisma.calendarNote.create({
      data: {
        householdId: households[0].id,
        startDate: new Date(Date.UTC(year, month, 5)),
        endDate: new Date(Date.UTC(year, month, 5)),
        body: "[demo] Family visiting — may overlap weekends.",
        createdByUserId: adminUserId,
      },
    });
    const greenStart = new Date(Date.UTC(year, month, 12));
    const greenEnd = new Date(Date.UTC(year, month, 14));
    const hasGreen = await prisma.occupancyIndicator.findFirst({
      where: {
        householdId: households[0].id,
        startDate: greenStart,
        endDate: greenEnd,
        status: "green",
      },
    });
    if (!hasGreen) {
      await prisma.occupancyIndicator.create({
        data: {
          householdId: households[0].id,
          startDate: greenStart,
          endDate: greenEnd,
          status: "green",
          createdByUserId: adminUserId,
        },
      });
    }
  }
  if (households[2]) {
    const hasRed = await prisma.occupancyIndicator.findFirst({
      where: {
        householdId: households[2].id,
        startDate: sampleStart,
        endDate: sampleEnd,
        status: "red",
      },
    });
    if (!hasRed) {
      await prisma.occupancyIndicator.create({
        data: {
          householdId: households[2].id,
          startDate: sampleStart,
          endDate: sampleEnd,
          status: "red",
          createdByUserId: adminUserId,
        },
      });
    }
  }
}

async function main() {
  const admin = await seedBootstrap();

  if (envFlag("SEED_DEMO")) {
    await seedDemoCalendar(admin.id);
    console.info("Demo calendar data seeded.");
  }

  console.info(`Seed complete. Admin: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
