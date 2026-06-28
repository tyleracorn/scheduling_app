import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

const SLOT_COLORS = ["#2563EB", "#DC2626", "#16A34A", "#CA8A04", "#9333EA", "#0891B2", "#EA580C"];
const WORKER_BEE_NAME = "Worker Bee";
const WORKER_BEE_COLOR = "#64748B";

export async function ensureWorkerBeeHousehold() {
  const existing = await prisma.household.findFirst({ where: { isWorkerBee: true } });
  if (existing) return existing;

  await prisma.household.updateMany({ data: { isWorkerBee: false }, where: { isWorkerBee: true } });
  return prisma.household.create({
    data: {
      name: WORKER_BEE_NAME,
      color: WORKER_BEE_COLOR,
      active: true,
      isWorkerBee: true,
    },
  });
}

/** Ensure at least `slotCount` active owning households (excluding worker bee). */
export async function syncHouseholdSlots(slotCount: number) {
  if (slotCount < 1 || slotCount > 20) {
    throw new AppError(400, "validation_error", "household_slot_count must be 1–20");
  }

  await ensureWorkerBeeHousehold();

  const owning = await prisma.household.findMany({
    where: { isWorkerBee: false },
    orderBy: { createdAt: "asc" },
  });

  const activeOwning = owning.filter((h) => h.active);
  if (activeOwning.length < slotCount) {
    const need = slotCount - activeOwning.length;
    const inactive = owning.filter((h) => !h.active);
    for (let i = 0; i < need && i < inactive.length; i++) {
      await prisma.household.update({
        where: { id: inactive[i]!.id },
        data: { active: true },
      });
    }
  }

  const refreshed = await prisma.household.findMany({
    where: { isWorkerBee: false, active: true },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  while (refreshed.length + created < slotCount) {
    const n = refreshed.length + created + 1;
    await prisma.household.create({
      data: {
        name: `Household ${n}`,
        color: SLOT_COLORS[(n - 1) % SLOT_COLORS.length]!,
        active: true,
        isWorkerBee: false,
      },
    });
    created += 1;
  }

  return prisma.household.findMany({ orderBy: { name: "asc" } });
}

export function formatHousehold(h: {
  id: string;
  name: string;
  color: string;
  active: boolean;
  isWorkerBee: boolean;
  authority: "active" | "coordinator" | "admin";
}) {
  return {
    id: h.id,
    name: h.name,
    color: h.color,
    active: h.active,
    is_worker_bee: h.isWorkerBee,
    authority: h.isWorkerBee ? "active" : h.authority,
    is_coordinator: h.isWorkerBee ? false : h.authority === "coordinator",
  };
}
