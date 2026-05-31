import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError, errorBody } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { generateToken, hashToken, normalizeEmail } from "../lib/tokens.js";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  setSessionCookie,
} from "../lib/session.js";
import { config } from "../lib/config.js";
import { sendEmail, inviteLink, resetPasswordLink } from "../services/email.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
  display_name: z.string().min(1).max(100),
});

const forgotSchema = z.object({ email: z.string().email() });

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export async function authRoutes(app: FastifyInstance) {
  app.get("/api/v1/auth/me", async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send(errorBody("unauthenticated", "Not logged in"));
    }
    return { user: request.user };
  });

  app.post("/api/v1/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid login payload", parsed.error.flatten());
    }
    const email = normalizeEmail(parsed.data.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      throw new AppError(401, "invalid_credentials", "Invalid email or password");
    }
    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      throw new AppError(401, "invalid_credentials", "Invalid email or password");
    }
    const sessionId = await createSession(user.id);
    setSessionCookie(reply, sessionId);
    return { ok: true };
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const sessionId = request.cookies[config.sessionCookieName];
    await destroySession(sessionId);
    clearSessionCookie(reply);
    return reply.status(204).send();
  });

  app.post("/api/v1/auth/accept-invite", async (request, reply) => {
    const parsed = acceptInviteSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid payload", parsed.error.flatten());
    }
    const tokenHash = hashToken(parsed.data.token);
    const invite = await prisma.invite.findFirst({
      where: { tokenHash, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!invite) {
      throw new AppError(400, "invalid_token", "Invite link is invalid or expired");
    }
    const email = normalizeEmail(invite.email);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, "email_exists", "An account with this email already exists");
    }
    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          displayName: parsed.data.display_name,
          emailVerifiedAt: new Date(),
        },
      });
      await tx.householdMembership.create({
        data: { userId: created.id, householdId: invite.householdId },
      });
      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });
      return created;
    });
    const sessionId = await createSession(user.id);
    setSessionCookie(reply, sessionId);
    return { ok: true };
  });

  app.post("/api/v1/auth/forgot-password", async (request) => {
    const parsed = forgotSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid email");
    }
    const email = normalizeEmail(parsed.data.email);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.active) {
      const token = generateToken();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const link = resetPasswordLink(token);
      await sendEmail(
        email,
        "Reset your cabin scheduling password",
        `Use this link to reset your password (valid 1 hour):\n\n${link}`,
      );
    }
    return { ok: true, message: "If that email exists, a reset link was sent." };
  });

  app.post("/api/v1/auth/reset-password", async (request) => {
    const parsed = resetSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid payload");
    }
    const tokenHash = hashToken(parsed.data.token);
    const record = await prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!record || !record.user.active) {
      throw new AppError(400, "invalid_token", "Reset link is invalid or expired");
    }
    const passwordHash = await hashPassword(parsed.data.password);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
    return { ok: true };
  });
}
