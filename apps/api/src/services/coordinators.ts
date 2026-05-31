import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

const MAX_COORDINATORS = 3;

export async function assertCoordinatorLimit(userId: string, enabling: boolean): Promise<void> {
  if (!enabling) return;
  const count = await prisma.user.count({
    where: { isCoordinator: true, active: true, NOT: { id: userId } },
  });
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (existing?.isCoordinator) return;
  if (count >= MAX_COORDINATORS) {
    throw new AppError(422, "coordinator_limit", `At most ${MAX_COORDINATORS} coordinators allowed`);
  }
}
