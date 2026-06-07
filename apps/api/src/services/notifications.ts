import { prisma } from "../lib/prisma.js";
import { sendEmail } from "./email.js";

const EMAIL_EVENT_TYPES = new Set([
  "your_turn",
  "turn_warning",
  "draft_on_hold",
  "assignment_phase_started",
  "period_published",
  "assignment_changed",
]);

async function deliverEmail(userId: string, type: string, subject: string, text: string, send: boolean) {
  if (!send) return;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.active) return;
  await sendEmail(user.email, subject, text);
}

function wantsEmail(type: string, options: { email?: boolean }): boolean {
  if (options.email === false) return false;
  return EMAIL_EVENT_TYPES.has(type);
}

export async function notifyHousehold(
  householdId: string,
  type: string,
  title: string,
  body: string,
  payload: Record<string, unknown> = {},
  options: { email?: boolean } = { email: true },
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
    if (wantsEmail(type, options)) {
      await deliverEmail(m.user.id, type, title, body, true);
    }
  }
}

export async function notifyCoordinators(
  type: string,
  title: string,
  body: string,
  payload: Record<string, unknown> = {},
  options: { email?: boolean } = { email: true },
) {
  const coordinatorHouseholds = await prisma.household.findMany({
    where: { isCoordinator: true, isWorkerBee: false, active: true },
    select: { id: true },
  });
  const householdIds = coordinatorHouseholds.map((h) => h.id);

  const members =
    householdIds.length > 0
      ? await prisma.householdMembership.findMany({
          where: { householdId: { in: householdIds } },
          include: { user: true },
        })
      : [];

  const admins = await prisma.user.findMany({
    where: { active: true, isAdmin: true },
  });

  const notified = new Set<string>();
  for (const m of members) {
    if (!m.user.active || notified.has(m.user.id)) continue;
    notified.add(m.user.id);
    await prisma.notification.create({
      data: {
        userId: m.user.id,
        type,
        title,
        body,
        payload: payload as object,
      },
    });
    if (wantsEmail(type, options)) {
      await deliverEmail(m.user.id, type, title, body, true);
    }
  }
  for (const u of admins) {
    if (notified.has(u.id)) continue;
    notified.add(u.id);
    await prisma.notification.create({
      data: {
        userId: u.id,
        type,
        title,
        body,
        payload: payload as object,
      },
    });
    if (wantsEmail(type, options)) {
      await deliverEmail(u.id, type, title, body, true);
    }
  }
}

export async function notifyAllUsers(
  type: string,
  title: string,
  body: string,
  payload: Record<string, unknown> = {},
  options: { email?: boolean } = { email: true },
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
    if (wantsEmail(type, options)) {
      await deliverEmail(u.id, type, title, body, true);
    }
  }
}
