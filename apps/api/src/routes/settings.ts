import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import {
  formatSystemSettingsForApi,
  pickWarningLeadHoursFromDays,
  pickWindowHoursFromDays,
} from "../lib/settings-format.js";
import { requireAuth, requireAdmin } from "../plugins/auth.js";
import { prisma } from "../lib/prisma.js";

const settingsSchema = z.object({
  week_start_day: z.number().int().min(0).max(6).optional(),
  week_selections_per_household: z.number().int().min(1).max(10).optional(),
  pick_window_days: z.number().int().min(1).max(14).optional(),
  pick_warning_lead_days: z.number().int().min(0).max(7).optional(),
  history_retention_years: z.number().int().min(1).max(20).optional(),
});

async function loadSettings() {
  return prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/v1/settings", async (request) => {
    requireAuth(request);
    const settings = await loadSettings();
    return { settings: formatSystemSettingsForApi(settings) };
  });

  app.put("/api/v1/settings", async (request) => {
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid settings", parsed.error.flatten());
    }
    const admin = requireAdmin(request);
    const d = parsed.data;
    const settings = await prisma.systemSettings.update({
      where: { id: 1 },
      data: {
        weekStartDay: d.week_start_day,
        weekSelectionsPerHousehold: d.week_selections_per_household,
        pickWindowHours:
          d.pick_window_days !== undefined
            ? pickWindowHoursFromDays(d.pick_window_days)
            : undefined,
        pickWarningLeadHours:
          d.pick_warning_lead_days !== undefined
            ? pickWarningLeadHoursFromDays(d.pick_warning_lead_days)
            : undefined,
        historyRetentionYears: d.history_retention_years,
        updatedByUserId: admin.id,
      },
    });
    return { settings: formatSystemSettingsForApi(settings) };
  });
}
