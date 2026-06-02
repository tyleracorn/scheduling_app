import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { parseDateString, toDateString } from "../lib/dates.js";
import { retentionCutoffDate } from "../lib/retention.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../plugins/auth.js";

const dateRangeSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const noteBodySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  body: z.string().min(1).max(2000),
});

function requireHouseholdId(user: { householdId: string | null }): string {
  if (!user.householdId) {
    throw new AppError(403, "no_household", "You must belong to a household to manage notes");
  }
  return user.householdId;
}

function formatNote(
  note: {
    id: string;
    householdId: string;
    startDate: Date;
    endDate: Date;
    body: string;
    household: { name: string };
  },
) {
  return {
    id: note.id,
    household_id: note.householdId,
    household_name: note.household.name,
    start_date: toDateString(note.startDate),
    end_date: toDateString(note.endDate),
    body: note.body,
  };
}

async function notesRoutes(app: FastifyInstance) {
  app.get("/api/v1/notes", async (request) => {
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
    const notes = await prisma.calendarNote.findMany({
      where: {
        startDate: { lte: rangeEnd },
        endDate: { gte: minEnd },
      },
      include: { household: true },
      orderBy: { startDate: "asc" },
    });
    return { notes: notes.map(formatNote) };
  });

  app.post("/api/v1/notes", async (request) => {
    const user = requireAuth(request);
    const householdId = requireHouseholdId(user);
    const parsed = noteBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid note", parsed.error.flatten());
    }
    if (parsed.data.start_date > parsed.data.end_date) {
      throw new AppError(400, "validation_error", "start_date must be on or before end_date");
    }
    const settings = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
    const cutoff = retentionCutoffDate(settings.historyRetentionYears);
    const cutoffStr = toDateString(cutoff);
    if (parsed.data.start_date < cutoffStr) {
      throw new AppError(
        400,
        "date_out_of_range",
        `Notes cannot start before ${cutoffStr} (history retention).`,
      );
    }
    const note = await prisma.calendarNote.create({
      data: {
        householdId,
        startDate: parseDateString(parsed.data.start_date),
        endDate: parseDateString(parsed.data.end_date),
        body: parsed.data.body,
        createdByUserId: user.id,
      },
      include: { household: true },
    });
    return { note: formatNote(note) };
  });

  app.patch("/api/v1/notes/:id", async (request) => {
    const user = requireAuth(request);
    const householdId = requireHouseholdId(user);
    const { id } = request.params as { id: string };
    const parsed = noteBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid note", parsed.error.flatten());
    }
    const existing = await prisma.calendarNote.findUnique({ where: { id } });
    if (!existing || existing.householdId !== householdId) {
      throw new AppError(404, "not_found", "Note not found");
    }
    const note = await prisma.calendarNote.update({
      where: { id },
      data: {
        startDate: parseDateString(parsed.data.start_date),
        endDate: parseDateString(parsed.data.end_date),
        body: parsed.data.body,
      },
      include: { household: true },
    });
    return { note: formatNote(note) };
  });

  app.delete("/api/v1/notes/:id", async (request, reply) => {
    const user = requireAuth(request);
    const householdId = requireHouseholdId(user);
    const { id } = request.params as { id: string };
    const existing = await prisma.calendarNote.findUnique({ where: { id } });
    if (!existing || existing.householdId !== householdId) {
      throw new AppError(404, "not_found", "Note not found");
    }
    await prisma.calendarNote.delete({ where: { id } });
    return reply.status(204).send();
  });
}

export default fp(notesRoutes, { name: "notes-routes" });
