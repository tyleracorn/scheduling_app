import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../plugins/auth.js";
import { getCalendarAggregate } from "../services/calendar.js";

const querySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function calendarRoutes(app: FastifyInstance) {
  app.get("/api/v1/calendar", async (request) => {
    requireAuth(request);
    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Query params start and end required (YYYY-MM-DD)");
    }
    if (parsed.data.start > parsed.data.end) {
      throw new AppError(400, "validation_error", "start must be on or before end");
    }
    return getCalendarAggregate(parsed.data);
  });
}

export default fp(calendarRoutes, { name: "calendar-routes" });
