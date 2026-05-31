import { prisma } from "../lib/prisma.js";

export async function notifyHousehold(
  householdId: string,
  type: string,
  title: string,
  body: string,
  payload: Record<string, unknown> = {},
) {
  const members = await prisma.householdMembership.findMany({
    where: { householdId },
    include: { user: true },
  });
  for (const m of members) {
    if (!m.user.active) continue;
    await prisma.notification.create({
      data: {
        userId: m.user.id,
        type,
        title,
        body,
        payload: payload as object,
      },
    });
  }
}

export async function notifyCoordinators(
  type: string,
  title: string,
  body: string,
  payload: Record<string, unknown> = {},
) {
  const coordinators = await prisma.user.findMany({
    where: { active: true, OR: [{ isCoordinator: true }, { isAdmin: true }] },
  });
  for (const u of coordinators) {
    await prisma.notification.create({
      data: {
        userId: u.id,
        type,
        title,
        body,
        payload: payload as object,
      },
    });
  }
}

export async function notifyAllUsers(
  type: string,
  title: string,
  body: string,
  payload: Record<string, unknown> = {},
) {
  const users = await prisma.user.findMany({ where: { active: true } });
  for (const u of users) {
    await prisma.notification.create({
      data: {
        userId: u.id,
        type,
        title,
        body,
        payload: payload as object,
      },
    });
  }
}
