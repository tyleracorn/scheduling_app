import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import type { PeriodStatus } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { requireAuth, requireCoordinator } from "../plugins/auth.js";
import {
  createPeriod,
  getPeriodDetail,
  listPeriods,
  setPeriodPriorities,
  updatePeriod,
} from "../services/periods.js";
import {
  coordinatorForceSkip,
  coordinatorPickFor,
  changePick,
  confirmPick,
  getDraftState,
  pickWeek,
  resumeDraft,
  reviseCompletedPick,
  skipTurn,
  startDraft,
} from "../services/draft.js";
import {
  assignWeek,
  getAssignedWeeks,
  getUnassignedWeeks,
  publishPeriod,
  swapWeeks,
} from "../services/assignments.js";
import {
  deletePeriod,
  generatePeriodsFromPlan,
  getPeriodPlan,
  resetPeriod,
  savePeriodPlan,
} from "../services/period-plan.js";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  opening_at: z.string().min(1),
});

const updateSchema = createSchema.partial();

const prioritiesSchema = z.object({
  priorities: z.array(
    z.object({
      household_id: z.string().uuid(),
      position: z.number().int().min(1),
    }),
  ),
});

const pickSchema = z.object({
  period_week_id: z.string().uuid(),
  client_action_id: z.string().optional(),
  occupancy_status: z.enum(["green", "red"]).optional(),
});

const confirmPickSchema = z.object({
  occupancy_status: z.enum(["green", "red"]).optional(),
});

const revisePickSchema = z.object({
  period_week_id: z.string().uuid().nullable(),
  occupancy_status: z.enum(["green", "red"]).optional(),
});

const resumeSchema = z.object({
  reset_auto_skip_counter: z.boolean().optional(),
});

const planSchema = z.object({
  first_week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weeks_per_period: z.number().int().min(1).max(52),
  rounds_per_household: z.number().int().min(1).max(10),
  periods_to_schedule: z.number().int().min(1).max(12),
  week_start_day: z.number().int().min(0).max(6),
});

const generateSchema = z.object({
  replace_unstarted: z.boolean().optional(),
});

const assignSchema = z.object({
  household_id: z.string().uuid(),
  reason: z.string().min(1).max(500).optional(),
  occupancy_status: z.enum(["green", "red"]).nullable().optional(),
});

const swapWeeksSchema = z.object({
  week_a_id: z.string().uuid(),
  week_b_id: z.string().uuid(),
  occupancy_a: z.enum(["green", "red"]).nullable().optional(),
  occupancy_b: z.enum(["green", "red"]).nullable().optional(),
  reason: z.string().min(1).max(500).optional(),
});

async function periodsRoutes(app: FastifyInstance) {
  app.get("/api/v1/periods", async (request) => {
    requireAuth(request);
    const status = (request.query as { status?: string }).status;
    const yearRaw = (request.query as { year?: string }).year;
    const year = yearRaw ? parseInt(yearRaw, 10) : undefined;
    if (status && !["scheduled", "open", "draft", "assignment", "published", "archived"].includes(status)) {
      throw new AppError(400, "validation_error", "Invalid status filter");
    }
    return {
      periods: await listPeriods({
        status: status as PeriodStatus | undefined,
        year: Number.isFinite(year) ? year : undefined,
      }),
    };
  });

  app.get("/api/v1/periods/plan", async (request) => {
    requireCoordinator(request);
    return { plan: await getPeriodPlan() };
  });

  app.put("/api/v1/periods/plan", async (request) => {
    const user = requireCoordinator(request);
    const parsed = planSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid plan", parsed.error.flatten());
    }
    const plan = await savePeriodPlan({
      ...parsed.data,
      updated_by_user_id: user.id,
    });
    return { plan };
  });

  app.post("/api/v1/periods/generate", async (request) => {
    const user = requireCoordinator(request);
    const parsed = generateSchema.safeParse(request.body ?? {});
    const result = await generatePeriodsFromPlan(user.id, {
      replace_unstarted: parsed.data?.replace_unstarted,
    });
    return result;
  });

  app.get("/api/v1/periods/:id", async (request) => {
    requireAuth(request);
    const { id } = request.params as { id: string };
    return { period: await getPeriodDetail(id) };
  });

  app.post("/api/v1/periods", async (request) => {
    const user = requireCoordinator(request);
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid period", parsed.error.flatten());
    }
    const period = await createPeriod({
      ...parsed.data,
      created_by_user_id: user.id,
    });
    return { period };
  });

  app.patch("/api/v1/periods/:id", async (request) => {
    requireCoordinator(request);
    const { id } = request.params as { id: string };
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid period", parsed.error.flatten());
    }
    const period = await updatePeriod(id, parsed.data);
    return { period };
  });

  app.delete("/api/v1/periods/:id", async (request) => {
    requireCoordinator(request);
    const { id } = request.params as { id: string };
    await deletePeriod(id);
    return { ok: true };
  });

  app.post("/api/v1/periods/:id/reset", async (request) => {
    requireCoordinator(request);
    const { id } = request.params as { id: string };
    return await resetPeriod(id);
  });

  app.put("/api/v1/periods/:id/priorities", async (request) => {
    requireCoordinator(request);
    const { id } = request.params as { id: string };
    const parsed = prioritiesSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid priorities", parsed.error.flatten());
    }
    const period = await setPeriodPriorities(id, parsed.data.priorities);
    return { period };
  });

  app.post("/api/v1/periods/:id/start-draft", async (request) => {
    requireCoordinator(request);
    const { id } = request.params as { id: string };
    const draft = await startDraft(id);
    return { draft };
  });

  app.get("/api/v1/periods/:id/draft", async (request) => {
    requireAuth(request);
    const { id } = request.params as { id: string };
    const draft = await getDraftState(id);
    return { draft };
  });

  app.post("/api/v1/periods/:id/draft/resume", async (request) => {
    requireCoordinator(request);
    const { id } = request.params as { id: string };
    const parsed = resumeSchema.safeParse(request.body ?? {});
    const draft = await resumeDraft(id, parsed.data?.reset_auto_skip_counter ?? true);
    return { draft };
  });

  app.post("/api/v1/periods/:periodId/turns/:turnId/pick", async (request) => {
    const user = requireAuth(request);
    if (!user.householdId) {
      throw new AppError(403, "forbidden", "You must belong to a household");
    }
    const { turnId } = request.params as { periodId: string; turnId: string };
    const parsed = pickSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "period_week_id required");
    }
    const draft = await pickWeek(turnId, parsed.data.period_week_id, user.id, user.householdId);
    return { draft };
  });

  app.post("/api/v1/periods/:periodId/turns/:turnId/skip", async (request) => {
    const user = requireAuth(request);
    if (!user.householdId) {
      throw new AppError(403, "forbidden", "You must belong to a household");
    }
    const { turnId } = request.params as { periodId: string; turnId: string };
    const draft = await skipTurn(turnId, user.id, user.householdId);
    return { draft };
  });

  app.post("/api/v1/periods/:periodId/turns/:turnId/change-pick", async (request) => {
    const user = requireAuth(request);
    if (!user.householdId) {
      throw new AppError(403, "forbidden", "You must belong to a household");
    }
    const { turnId } = request.params as { periodId: string; turnId: string };
    const parsed = pickSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "period_week_id required");
    }
    const draft = await changePick(turnId, parsed.data.period_week_id, user.id, user.householdId);
    return { draft };
  });

  app.post("/api/v1/periods/:periodId/turns/:turnId/revise-pick", async (request) => {
    const user = requireAuth(request);
    const isCoordinator = user.isCoordinator || user.isAdmin;
    if (!isCoordinator && !user.householdId) {
      throw new AppError(403, "forbidden", "You must belong to a household");
    }
    const { turnId } = request.params as { periodId: string; turnId: string };
    const parsed = revisePickSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "period_week_id required (use null to release)");
    }
    const draft = await reviseCompletedPick(
      turnId,
      user.id,
      user.householdId,
      isCoordinator,
      parsed.data.period_week_id,
      parsed.data.occupancy_status,
    );
    return { draft };
  });

  app.post("/api/v1/periods/:periodId/turns/:turnId/confirm-pick", async (request) => {
    const user = requireAuth(request);
    if (!user.householdId) {
      throw new AppError(403, "forbidden", "You must belong to a household");
    }
    const { turnId } = request.params as { periodId: string; turnId: string };
    const parsed = confirmPickSchema.safeParse(request.body ?? {});
    const draft = await confirmPick(
      turnId,
      user.id,
      user.householdId,
      parsed.data?.occupancy_status,
    );
    return { draft };
  });

  app.get("/api/v1/periods/:id/assignments/assigned", async (request) => {
    requireCoordinator(request);
    const { id } = request.params as { id: string };
    return await getAssignedWeeks(id);
  });

  app.get("/api/v1/periods/:id/assignments/unassigned", async (request) => {
    requireCoordinator(request);
    const { id } = request.params as { id: string };
    return await getUnassignedWeeks(id);
  });

  app.put("/api/v1/periods/:periodId/assignments/:weekId", async (request) => {
    const user = requireCoordinator(request);
    const { periodId, weekId } = request.params as { periodId: string; weekId: string };
    const parsed = assignSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid assignment", parsed.error.flatten());
    }
    return await assignWeek(
      periodId,
      weekId,
      parsed.data.household_id,
      user.id,
      parsed.data.reason,
      parsed.data.occupancy_status,
    );
  });

  app.post("/api/v1/periods/:periodId/assignments/swap", async (request) => {
    const user = requireCoordinator(request);
    const { periodId } = request.params as { periodId: string };
    const parsed = swapWeeksSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "Invalid swap request", parsed.error.flatten());
    }
    return await swapWeeks(
      periodId,
      parsed.data.week_a_id,
      parsed.data.week_b_id,
      user.id,
      parsed.data.occupancy_a,
      parsed.data.occupancy_b,
      parsed.data.reason,
    );
  });

  app.post("/api/v1/periods/:id/publish", async (request) => {
    const user = requireCoordinator(request);
    const { id } = request.params as { id: string };
    return await publishPeriod(id, user.id);
  });

  app.post("/api/v1/periods/:periodId/turns/:turnId/force-skip", async (request) => {
    const user = requireCoordinator(request);
    const { turnId } = request.params as { periodId: string; turnId: string };
    const draft = await coordinatorForceSkip(turnId, user.id);
    return { draft };
  });

  app.post("/api/v1/periods/:periodId/turns/:turnId/coordinator-pick", async (request) => {
    const user = requireCoordinator(request);
    const { turnId } = request.params as { periodId: string; turnId: string };
    const parsed = pickSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "validation_error", "period_week_id required");
    }
    const draft = await coordinatorPickFor(
      turnId,
      parsed.data.period_week_id,
      user.id,
      parsed.data.occupancy_status,
    );
    return { draft };
  });
}

export default fp(periodsRoutes, { name: "periods-routes" });
