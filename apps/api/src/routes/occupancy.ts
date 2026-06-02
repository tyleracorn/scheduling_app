import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { parseDateString, toDateString } from "../lib/dates.js";
import { retentionCutoffDate } from "../lib/retention.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../plugins/auth.js";
import { setHouseholdDayOccupancy } from "../services/occupancy-week.js";

const dayOccupancySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["green", "red"]).nullable(),
});

const dateRangeSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const occupancyBodySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["green", "red"]),
});

function requireHouseholdId(user: { householdId: string | null }): string {
  if (!user.householdId) {
    throw new AppError(403, "no_household", "You must belong to a household to manage occupancy");
  }
  return user.householdId;
}

function formatOccupancy(
  row: {
    id: string;
    householdId: string;
    startDate: Date;
    endDate: Date;
    status: "green" | "red";
    household: { name: string };
  },
) {
  return {
    id: row.id,
    household_id: row.householdId,
    household_name: row.household.name,
    start_date: toDateString(row.startDate),
    end_date: toDateString(row.endDate),
    status: row.status,
  };
}

async function occupancyRoutes(app: FastifyInstance) {
  app.get("/api/v1/occupancy", async (request) => {
    requireAuth(request);
    const parsed = dateRangeSchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Query start and end required (YYYY-MM-DD)");
    }
    const settings = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
    const cutoff = retentionCutoffDate(settings.historyRetentionYears);
    const rangeStart = parseDateString(parsed.data.start);
    const rangeEnd = parseDateString(parsed.data.end);

    const minEnd = rangeStart > cutoff ? rangeStart : cutoff;
    const rows = await prisma.occupancyIndicator.findMany({
      where: {
        startDate: { lte: rangeEnd },
        endDate: { gte: minEnd },
      },
      include: { household: true },
      orderBy: { startDate: "asc" },
    });
    return { occupancy: rows.map(formatOccupancy) };
  });

  app.post("/api/v1/occupancy", async (request) => {
    const user = requireAuth(request);
    const householdId = requireHouseholdId(user);
    const parsed = occupancyBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid occupancy", parsed.error.flatten());
    }
    if (parsed.data.start_date > parsed.data.end_date) {
      throw new AppError(400, "validation_error", "start_date must be on or before end_date");
    }
    const row = await prisma.occupancyIndicator.create({
      data: {
        householdId,
        startDate: parseDateString(parsed.data.start_date),
        endDate: parseDateString(parsed.data.end_date),
        status: parsed.data.status,
        createdByUserId: user.id,
      },
      include: { household: true },
    });
    return { occupancy: formatOccupancy(row) };
  });

  app.patch("/api/v1/occupancy/:id", async (request) => {
    const user = requireAuth(request);
    const householdId = requireHouseholdId(user);
    const { id } = request.params as { id: string };
    const parsed = occupancyBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid occupancy", parsed.error.flatten());
    }
    const existing = await prisma.occupancyIndicator.findUnique({ where: { id } });
    if (!existing || existing.householdId !== householdId) {
      throw new AppError(404, "not_found", "Occupancy indicator not found");
    }
    const row = await prisma.occupancyIndicator.update({
      where: { id },
      data: {
        startDate: parseDateString(parsed.data.start_date),
        endDate: parseDateString(parsed.data.end_date),
        status: parsed.data.status,
      },
      include: { household: true },
    });
    return { occupancy: formatOccupancy(row) };
  });

  app.put("/api/v1/occupancy/day", async (request) => {
    const user = requireAuth(request);
    const householdId = requireHouseholdId(user);
    const parsed = dayOccupancySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid day occupancy", parsed.error.flatten());
    }
    const settings = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
    const cutoff = retentionCutoffDate(settings.historyRetentionYears);
    const cutoffStr = toDateString(cutoff);
    if (parsed.data.date < cutoffStr) {
      throw new AppError(
        400,
        "date_out_of_range",
        `Occupancy cannot be set before ${cutoffStr} (history retention).`,
      );
    }
    await setHouseholdDayOccupancy(householdId, parsed.data.date, parsed.data.status, user.id);
    return { ok: true };
  });

  app.delete("/api/v1/occupancy/:id", async (request, reply) => {
    const user = requireAuth(request);
    const householdId = requireHouseholdId(user);
    const { id } = request.params as { id: string };
    const existing = await prisma.occupancyIndicator.findUnique({ where: { id } });
    if (!existing || existing.householdId !== householdId) {
      throw new AppError(404, "not_found", "Occupancy indicator not found");
    }
    await prisma.occupancyIndicator.delete({ where: { id } });
    return reply.status(204).send();
  });
}

export default fp(occupancyRoutes, { name: "occupancy-routes" });
