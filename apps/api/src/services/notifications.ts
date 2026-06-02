import { prisma } from "../lib/prisma.js";
import { sendEmail } from "./email.js";

const EMAIL_EVENT_TYPES = new Set([
  "your_turn",
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
