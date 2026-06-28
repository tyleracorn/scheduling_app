import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { parseDateString, toDateString } from "../lib/dates.js";
import { retentionCutoffDate } from "../lib/retention.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../plugins/auth.js";
import { calendarNoteInclude, formatCalendarNote } from "../lib/format-note.js";

const dateRangeSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const noteBodySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  body: z.string().min(1).max(2000),
  category_id: z.string().uuid().optional().nullable(),
});

function requireHouseholdId(user: { householdId: string | null }): string {
  if (!user.householdId) {
    throw new AppError(403, "no_household", "You must belong to a household to manage notes");
  }
  return user.householdId;
}

function formatNote(note: Parameters<typeof formatCalendarNote>[0]) {
  return formatCalendarNote(note);
}

async function notesRoutes(app: FastifyInstance) {
  app.get("/api/v1/note-categories", async (request) => {
    requireAuth(request);
    const categories = await prisma.noteCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        color: c.color,
        sort_order: c.sortOrder,
      })),
    };
  });

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
      include: calendarNoteInclude,
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
    if (parsed.data.category_id) {
      const cat = await prisma.noteCategory.findFirst({
        where: { id: parsed.data.category_id, active: true },
      });
      if (!cat) throw new AppError(400, "validation_error", "Invalid category");
    }
    const note = await prisma.calendarNote.create({
      data: {
        householdId,
        categoryId: parsed.data.category_id ?? null,
        startDate: parseDateString(parsed.data.start_date),
        endDate: parseDateString(parsed.data.end_date),
        body: parsed.data.body,
        createdByUserId: user.id,
      },
      include: calendarNoteInclude,
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
    if (parsed.data.category_id) {
      const cat = await prisma.noteCategory.findFirst({
        where: { id: parsed.data.category_id, active: true },
      });
      if (!cat) throw new AppError(400, "validation_error", "Invalid category");
    }
    const note = await prisma.calendarNote.update({
      where: { id },
      data: {
        startDate: parseDateString(parsed.data.start_date),
        endDate: parseDateString(parsed.data.end_date),
        body: parsed.data.body,
        categoryId: parsed.data.category_id ?? null,
      },
      include: calendarNoteInclude,
    });
    return { note: formatNote(note) };
  });

  app.delete("/api/v1/notes/:id", async (request, reply) => {
    const user = requireAuth(request);
    const { id } = request.params as { id: string };
    const existing = await prisma.calendarNote.findUnique({ where: { id } });
    if (!existing || existing.createdByUserId !== user.id) {
      throw new AppError(404, "not_found", "Note not found");
    }
    await prisma.calendarNote.delete({ where: { id } });
    return reply.status(204).send();
  });
}

export default fp(notesRoutes, { name: "notes-routes" });
