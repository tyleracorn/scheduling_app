import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { prisma } from "../lib/prisma.js";

export async function householdsRoutes(app: FastifyInstance) {
  app.get("/api/v1/households", async (request) => {
    requireAuth(request);
    const households = await prisma.household.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return {
      households: households.map((h) => ({
        id: h.id,
        name: h.name,
        color: h.color,
        active: h.active,
      })),
    };
  });
}
