import type { FastifyReply } from "fastify";
import { config } from "./config.js";
import { prisma } from "./prisma.js";
import { generateToken, hashToken } from "./tokens.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + config.sessionDays * MS_PER_DAY);
  await prisma.session.create({
    data: { userId, expiresAt, tokenHash: hashToken(token) },
  });
  return token;
}

export async function getSessionUserId(sessionToken: string | undefined): Promise<string | null> {
  if (!sessionToken) return null;
  const tokenHash = hashToken(sessionToken);
  const session = await prisma.session.findUnique({ where: { tokenHash } });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { tokenHash } }).catch(() => {});
    return null;
  }
  return session.userId;
}

export function setSessionCookie(reply: FastifyReply, sessionToken: string): void {
  const maxAge = config.sessionDays * 24 * 60 * 60;
  reply.setCookie(config.sessionCookieName, sessionToken, {
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

export async function destroySession(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken) return;
  await prisma.session.delete({ where: { tokenHash: hashToken(sessionToken) } }).catch(() => {});
}

export async function destroyOtherUserSessions(
  userId: string,
  keepSessionToken: string | undefined,
): Promise<void> {
  await prisma.session.deleteMany({
    where: {
      userId,
      ...(keepSessionToken ? { tokenHash: { not: hashToken(keepSessionToken) } } : {}),
    },
  });
}
