import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  canUseSchedulingTools,
  hasCoordinatorHouseholdTier,
  isSystemAdmin,
} from "../lib/authority.js";
import { requireAuth, requireCoordinatorHouseholdTier } from "../plugins/auth.js";
import {
  formatHousehold,
  normalizeShortCode,
} from "../services/households.js";

const profileSchema = z.object({
  display_name: z.string().min(1).max(100),
});

const passwordSchema = z.object({
  current_password: z.string().min(8),
  new_password: z.string().min(8),
});

const schedulingToolsSchema = z.object({
  enabled: z.boolean(),
});

const householdPatchSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    short_code: z.string().min(1).max(3).optional(),
  })
  .refine((d) => d.name !== undefined || d.short_code !== undefined, {
    message: "Provide name and/or short_code",
  });

function formatUser(user: {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  schedulingToolsEnabled: boolean;
  membership: {
    householdId: string;
    household: {
      name: string;
      shortCode: string;
      authority: "active" | "coordinator" | "admin";
      isWorkerBee: boolean;
    };
  } | null;
}) {
  const household = user.membership?.household;
  const ctx = {
    isAdmin: user.isAdmin,
    schedulingToolsEnabled: user.schedulingToolsEnabled,
    household: household
      ? { authority: household.authority, isWorkerBee: household.isWorkerBee }
      : null,
  };
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isAdmin: isSystemAdmin(ctx),
    isCoordinator: canUseSchedulingTools(ctx),
    householdAuthority: household?.isWorkerBee ? null : (household?.authority ?? null),
    schedulingToolsEnabled: user.schedulingToolsEnabled,
    canToggleSchedulingTools: hasCoordinatorHouseholdTier(ctx),
    householdId: user.membership?.householdId ?? null,
    householdName: household?.name ?? null,
    householdShortCode: household?.shortCode ?? null,
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

  app.patch("/api/v1/me/household", async (request) => {
    const authUser = requireAuth(request);
    if (!authUser.householdId) {
      throw new AppError(422, "no_household", "You are not assigned to a household");
    }
    const parsed = householdPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid household", parsed.error.flatten());
    }

    const data: { name?: string; shortCode?: string } = {};
    if (parsed.data.name !== undefined) {
      data.name = parsed.data.name.trim();
    }
    if (parsed.data.short_code !== undefined) {
      const shortCode = normalizeShortCode(parsed.data.short_code);
      const clash = await prisma.household.findFirst({
        where: { shortCode, id: { not: authUser.householdId } },
      });
      if (clash) {
        throw new AppError(409, "short_code_taken", `Short code ${shortCode} is already in use`);
      }
      data.shortCode = shortCode;
    }

    const household = await prisma.household.update({
      where: { id: authUser.householdId },
      data,
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: authUser.id },
      include: { membership: { include: { household: true } } },
    });
    return {
      household: formatHousehold(household),
      user: formatUser(user),
    };
  });

  app.patch("/api/v1/me/scheduling-tools", async (request) => {
    requireCoordinatorHouseholdTier(request);
    const authUser = requireAuth(request);
    const parsed = schedulingToolsSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid payload", parsed.error.flatten());
    }
    const user = await prisma.user.update({
      where: { id: authUser.id },
      data: { schedulingToolsEnabled: parsed.data.enabled },
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
