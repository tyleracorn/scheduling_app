import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { formatSystemSettingsForApi } from "../lib/settings-format.js";
import { prisma } from "../lib/prisma.js";

async function loadSettings() {
  return prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/v1/settings", async (request) => {
    requireAuth(request);
    const settings = await loadSettings();
    return { settings: formatSystemSettingsForApi(settings) };
  });
}
