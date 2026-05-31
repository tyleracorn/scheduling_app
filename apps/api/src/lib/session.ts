import type { FastifyReply } from "fastify";
import { config } from "./config.js";
import { prisma } from "./prisma.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + config.sessionDays * MS_PER_DAY);
  const session = await prisma.session.create({
    data: { userId, expiresAt },
  });
  return session.id;
}

export async function getSessionUserId(sessionId: string | undefined): Promise<string | null> {
  if (!sessionId) return null;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }
  return session.userId;
}

export function setSessionCookie(reply: FastifyReply, sessionId: string): void {
  const maxAge = config.sessionDays * 24 * 60 * 60;
  reply.setCookie(config.sessionCookieName, sessionId, {
    path: "/",
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    maxAge,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(config.sessionCookieName, { path: "/" });
}

export async function destroySession(sessionId: string | undefined): Promise<void> {
  if (!sessionId) return;
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
}
