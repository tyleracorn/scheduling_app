import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { generateToken, hashToken, normalizeEmail } from "../lib/tokens.js";
import { requireAdmin } from "../plugins/auth.js";
import { sendEmail, inviteLink, getSmtpStatus } from "../services/email.js";
import { assertCoordinatorHouseholdLimit } from "../services/coordinators.js";
import {
  ensureWorkerBeeHousehold,
  formatHousehold,
  syncHouseholdSlots,
} from "../services/households.js";
import {
  formatSystemSettingsForApi,
  pickWarningLeadHoursFromDays,
  pickWindowHoursFromDays,
} from "../lib/settings-format.js";

const householdSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  active: z.boolean().optional(),
  is_worker_bee: z.boolean().optional(),
  is_coordinator: z.boolean().optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  household_id: z.string().uuid(),
});

const userPatchSchema = z.object({
  active: z.boolean().optional(),
  household_id: z.string().uuid().optional(),
});

const settingsSchema = z.object({
  week_start_day: z.number().int().min(0).max(6).optional(),
  week_selections_per_household: z.number().int().min(1).max(10).optional(),
  pick_window_days: z.number().int().min(1).max(14).optional(),
  pick_warning_lead_days: z.number().int().min(0).max(7).optional(),
  history_retention_years: z.number().int().min(1).max(20).optional(),
  household_slot_count: z.number().int().min(1).max(20).optional(),
});

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request) => {
    if (request.url.startsWith("/api/v1/admin")) {
      requireAdmin(request);
    }
  });

  app.get("/api/v1/admin/households", async () => {
    await ensureWorkerBeeHousehold();
    const households = await prisma.household.findMany({ orderBy: { name: "asc" } });
    return { households: households.map(formatHousehold) };
  });

  app.post("/api/v1/admin/households/sync", async () => {
    const settings = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
    const households = await syncHouseholdSlots(settings.householdSlotCount);
    return { households: households.map(formatHousehold) };
  });

  app.post("/api/v1/admin/households", async (request) => {
    const parsed = householdSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid household", parsed.error.flatten());
    }
    const household = await prisma.household.create({
      data: {
        name: parsed.data.name,
        color: parsed.data.color,
        active: parsed.data.active ?? true,
        isWorkerBee: parsed.data.is_worker_bee ?? false,
      },
    });
    if (parsed.data.is_worker_bee) {
      await prisma.household.updateMany({
        where: { id: { not: household.id }, isWorkerBee: true },
        data: { isWorkerBee: false },
      });
    }
    return { household: formatHousehold(household) };
  });

  app.patch("/api/v1/admin/households/:id", async (request) => {
    const { id } = request.params as { id: string };
    const parsed = householdSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid household", parsed.error.flatten());
    }
    const data = parsed.data;
    const existing = await prisma.household.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, "not_found", "Household not found");
    }

    if (data.is_worker_bee) {
      await prisma.household.updateMany({
        where: { id: { not: id }, isWorkerBee: true },
        data: { isWorkerBee: false },
      });
    }

    const willBeWorkerBee = data.is_worker_bee ?? existing.isWorkerBee;
    if (data.is_coordinator === true || (data.is_coordinator !== false && existing.isCoordinator)) {
      if (willBeWorkerBee) {
        throw new AppError(422, "invalid_household", "Worker Bee cannot be a coordinator household");
      }
    }
    if (data.is_coordinator === true) {
      await assertCoordinatorHouseholdLimit(id, true);
    }

    const household = await prisma.household.update({
      where: { id },
      data: {
        name: data.name,
        color: data.color,
        active: data.active,
        isWorkerBee: data.is_worker_bee,
        isCoordinator: willBeWorkerBee ? false : data.is_coordinator,
      },
    });
    return { household: formatHousehold(household) };
  });

  app.get("/api/v1/admin/users", async () => {
    const users = await prisma.user.findMany({
      orderBy: { email: "asc" },
      include: { membership: { include: { household: true } } },
    });
    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        display_name: u.displayName,
        is_admin: u.isAdmin,
        active: u.active,
        household_id: u.membership?.householdId ?? null,
        household_name: u.membership?.household.name ?? null,
        household_is_coordinator: Boolean(
          u.membership?.household.isCoordinator && !u.membership?.household.isWorkerBee,
        ),
      })),
    };
  });

  app.post("/api/v1/admin/users/invite", async (request) => {
    const parsed = inviteSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid invite", parsed.error.flatten());
    }
    const email = normalizeEmail(parsed.data.email);
    const household = await prisma.household.findUnique({ where: { id: parsed.data.household_id } });
    if (!household) {
      throw new AppError(404, "not_found", "Household not found");
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, "email_exists", "User already exists");
    }
    const pending = await prisma.invite.findFirst({
      where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (pending) {
      throw new AppError(409, "invite_pending", "An invite is already pending for this email");
    }
    const token = generateToken();
    const admin = requireAdmin(request);
    const invite = await prisma.invite.create({
      data: {
        email,
        householdId: parsed.data.household_id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedByUserId: admin.id,
      },
    });
    const link = inviteLink(token);
    await sendEmail(
      email,
      "You're invited to the cabin schedule",
      `You've been invited to join household "${household.name}".\n\nAccept invite (7 days):\n${link}`,
    );
    return { invite: { id: invite.id, email: invite.email, expires_at: invite.expiresAt } };
  });

  app.patch("/api/v1/admin/users/:id", async (request) => {
    const { id } = request.params as { id: string };
    const parsed = userPatchSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid user patch", parsed.error.flatten());
    }
    const data = parsed.data;
    const admin = requireAdmin(request);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new AppError(404, "not_found", "User not found");
    }

    if (data.active === false) {
      if (id === admin.id) {
        throw new AppError(409, "cannot_deactivate_self", "You cannot deactivate your own account");
      }
      if (target.isAdmin) {
        throw new AppError(409, "cannot_deactivate_admin", "Administrator accounts cannot be deactivated");
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        active: data.active,
      },
    });
    if (data.household_id) {
      await prisma.householdMembership.upsert({
        where: { userId: id },
        create: { userId: id, householdId: data.household_id },
        update: { householdId: data.household_id },
      });
    }
    return { user: { id: user.id, email: user.email, active: user.active } };
  });

  app.get("/api/v1/admin/settings", async () => {
    const settings = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
    return {
      settings: {
        ...formatSystemSettingsForApi(settings),
        household_slot_count: settings.householdSlotCount,
      },
    };
  });

  app.put("/api/v1/admin/settings", async (request) => {
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
        householdSlotCount: d.household_slot_count,
        updatedByUserId: admin.id,
      },
    });
    if (d.household_slot_count !== undefined) {
      await syncHouseholdSlots(d.household_slot_count);
    }
    return {
      settings: {
        ...formatSystemSettingsForApi(settings),
        household_slot_count: settings.householdSlotCount,
      },
    };
  });

  app.get("/api/v1/admin/email/status", async () => {
    return { email: getSmtpStatus() };
  });

  app.post("/api/v1/admin/email/test", async (request) => {
    const admin = requireAdmin(request);
    const status = getSmtpStatus();
    if (!status.configured) {
      throw new AppError(
        503,
        "email_not_configured",
        "SMTP is not configured. Set SMTP_HOST in the server environment.",
      );
    }
    await sendEmail(
      admin.email,
      "Cabin Schedule test email",
      "This is a test message from the cabin scheduling app. Email delivery is working.",
    );
    return { ok: true, sent_to: admin.email };
  });

  app.get("/api/v1/admin/audit", async (request) => {
    const limitRaw = (request.query as { limit?: string }).limit;
    const entityType = (request.query as { entity_type?: string }).entity_type;
    const limit = Math.min(Math.max(parseInt(limitRaw ?? "50", 10) || 50, 1), 200);

    const events = await prisma.auditEvent.findMany({
      where: entityType ? { entityType } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        actor: { select: { id: true, email: true, displayName: true } },
      },
    });

    return {
      events: events.map((e) => ({
        id: e.id,
        event_type: e.eventType,
        entity_type: e.entityType,
        entity_id: e.entityId,
        actor: {
          id: e.actor.id,
          email: e.actor.email,
          display_name: e.actor.displayName,
        },
        before: e.before,
        after: e.after,
        reason: e.reason,
        created_at: e.createdAt.toISOString(),
      })),
    };
  });
}
