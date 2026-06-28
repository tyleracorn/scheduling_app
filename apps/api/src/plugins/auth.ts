import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { HouseholdAuthority } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import {
  canUseSchedulingTools,
  hasCoordinatorHouseholdTier,
  isSystemAdmin,
} from "../lib/authority.js";
import { getSessionUserId } from "../lib/session.js";
import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  isCoordinator: boolean;
  householdAuthority: HouseholdAuthority | null;
  schedulingToolsEnabled: boolean;
  canToggleSchedulingTools: boolean;
  householdId: string | null;
  householdName: string | null;
};

declare module "fastify" {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

async function loadUser(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { membership: { include: { household: true } } },
  });
  if (!user || !user.active) return null;
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
  };
}

async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest("user", undefined);

  fastify.addHook("preHandler", async (request) => {
    const sessionId = request.cookies[config.sessionCookieName];
    const userId = await getSessionUserId(sessionId);
    if (userId) {
      const user = await loadUser(userId);
      if (user) request.user = user;
    }
  });
}

export function requireAuth(request: FastifyRequest): AuthUser {
  if (!request.user) {
    throw new AppError(401, "unauthenticated", "Authentication required");
  }
  return request.user;
}

export function requireAdmin(request: FastifyRequest): AuthUser {
  const user = requireAuth(request);
  if (!user.isAdmin) {
    throw new AppError(403, "forbidden", "Administrator access required");
  }
  return user;
}

export function requireCoordinator(request: FastifyRequest): AuthUser {
  const user = requireAuth(request);
  if (!user.isCoordinator) {
    throw new AppError(403, "forbidden", "Coordinator access required");
  }
  return user;
}

export function requireCoordinatorHouseholdTier(request: FastifyRequest): AuthUser {
  const user = requireAuth(request);
  if (
    !user.isAdmin &&
    !hasCoordinatorHouseholdTier({
      isAdmin: false,
      schedulingToolsEnabled: user.schedulingToolsEnabled,
      household: user.householdAuthority
        ? { authority: user.householdAuthority, isWorkerBee: false }
        : null,
    })
  ) {
    throw new AppError(403, "forbidden", "Coordinator household required");
  }
  return user;
}

export { loadUser };

export default fp(authPlugin, { name: "auth" });
