import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { AppError } from "../lib/errors.js";
import { getSessionUserId } from "../lib/session.js";
import { prisma } from "../lib/prisma.js";
import { config } from "../lib/config.js";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  isCoordinator: boolean;
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
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    isCoordinator: user.isCoordinator,
    householdId: user.membership?.householdId ?? null,
    householdName: user.membership?.household.name ?? null,
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

export default fp(authPlugin, { name: "auth" });
