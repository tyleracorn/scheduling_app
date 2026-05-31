import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { computePeriodWeeks } from "../src/lib/period-weeks.js";

const prisma = new PrismaClient();

const HOUSEHOLDS = [
  { name: "Household 1", color: "#2563EB" },
  { name: "Household 2", color: "#DC2626" },
  { name: "Household 3", color: "#16A34A" },
  { name: "Household 4", color: "#CA8A04" },
  { name: "Household 5", color: "#9333EA" },
];

async function main() {
  await prisma.systemSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      cabinTimezone: "America/Denver",
      weekStartDay: 0,
      weekSelectionsPerHousehold: 1,
      pickWindowHours: 72,
      pickWarningLeadHours: 12,
      historyRetentionYears: 3,
    },
    update: {},
  });

  for (const h of HOUSEHOLDS) {
    const existing = await prisma.household.findFirst({ where: { name: h.name } });
    if (!existing) {
      await prisma.household.create({ data: h });
    }
  }

  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "changeme";
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      displayName: "Administrator",
      isAdmin: true,
      isCoordinator: true,
      emailVerifiedAt: new Date(),
    },
    update: {
      passwordHash,
      isAdmin: true,
      isCoordinator: true,
      active: true,
    },
  });

  const firstHousehold = await prisma.household.findFirst({ orderBy: { name: "asc" } });
  if (firstHousehold) {
    await prisma.householdMembership.upsert({
      where: { userId: admin.id },
      create: { userId: admin.id, householdId: firstHousehold.id },
      update: { householdId: firstHousehold.id },
    });
  }

  await seedDemoCalendar(admin.id);

  console.info(`Seed complete. Admin: ${email}`);
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
  await prisma.schedulingPeriod.create({
    data: {
      name: "Upcoming scheduling period",
      startDate: nextStart,
      endDate: nextEnd,
      openingAt: new Date(Date.UTC(year, month + 3, 1, 9, 0, 0)),
      status: "open",
      createdByUserId: adminUserId,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
