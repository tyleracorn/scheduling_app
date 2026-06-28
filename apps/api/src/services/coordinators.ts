import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

export async function getMaxCoordinatorHouseholds(): Promise<number> {
  const settings = await prisma.systemSettings.findUniqueOrThrow({ where: { id: 1 } });
  return settings.maxCoordinatorHouseholds;
}

export async function assertCoordinatorHouseholdLimit(
  householdId: string,
  authority: "active" | "coordinator" | "admin",
): Promise<void> {
  if (authority !== "coordinator") return;

  const household = await prisma.household.findUnique({ where: { id: householdId } });
  if (!household || household.isWorkerBee) {
    throw new AppError(422, "invalid_household", "Worker Bee cannot be a coordinator household");
  }
  if (household.authority === "coordinator") return;

  const max = await getMaxCoordinatorHouseholds();
  const count = await prisma.household.count({
    where: {
      authority: "coordinator",
      isWorkerBee: false,
      NOT: { id: householdId },
    },
  });
  if (count >= max) {
    throw new AppError(
      422,
      "coordinator_limit",
      `At most ${max} coordinator households allowed`,
    );
  }
}
