import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

const MAX_COORDINATOR_HOUSEHOLDS = 3;

export async function assertCoordinatorHouseholdLimit(
  householdId: string,
  enabling: boolean,
): Promise<void> {
  if (!enabling) return;

  const household = await prisma.household.findUnique({ where: { id: householdId } });
  if (!household || household.isWorkerBee) {
    throw new AppError(422, "invalid_household", "Worker Bee cannot be a coordinator household");
  }
  if (household.isCoordinator) return;

  const count = await prisma.household.count({
    where: { isCoordinator: true, isWorkerBee: false, NOT: { id: householdId } },
  });
  if (count >= MAX_COORDINATOR_HOUSEHOLDS) {
    throw new AppError(
      422,
      "coordinator_limit",
      `At most ${MAX_COORDINATOR_HOUSEHOLDS} coordinator households allowed`,
    );
  }
}
