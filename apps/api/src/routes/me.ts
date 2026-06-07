import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { requireAuth } from "../plugins/auth.js";

const profileSchema = z.object({
  display_name: z.string().min(1).max(100),
});

const passwordSchema = z.object({
  current_password: z.string().min(8),
  new_password: z.string().min(8),
});

function formatUser(user: {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  membership: {
    householdId: string;
    household: { name: string; isCoordinator: boolean; isWorkerBee: boolean };
  } | null;
}) {
  const household = user.membership?.household;
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    isCoordinator: Boolean(household?.isCoordinator && !household?.isWorkerBee),
    householdId: user.membership?.householdId ?? null,
    householdName: household?.name ?? null,
  };
}

export async function meRoutes(app: FastifyInstance) {
  app.patch("/api/v1/me", async (request) => {
    const authUser = requireAuth(request);
    const parsed = profileSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid profile", parsed.error.flatten());
    }
    const user = await prisma.user.update({
      where: { id: authUser.id },
      data: { displayName: parsed.data.display_name },
      include: { membership: { include: { household: true } } },
    });
    return { user: formatUser(user) };
  });

  app.post("/api/v1/me/password", async (request) => {
    const authUser = requireAuth(request);
    const parsed = passwordSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid password payload", parsed.error.flatten());
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: authUser.id } });
    const ok = await verifyPassword(parsed.data.current_password, user.passwordHash);
    if (!ok) {
      throw new AppError(401, "invalid_password", "Current password is incorrect");
    }
    const passwordHash = await hashPassword(parsed.data.new_password);
    await prisma.user.update({
      where: { id: authUser.id },
      data: { passwordHash },
    });
    return { ok: true };
  });
}
