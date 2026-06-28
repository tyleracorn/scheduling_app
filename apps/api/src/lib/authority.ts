import type { HouseholdAuthority } from "@prisma/client";

export type HouseholdAuthContext = {
  authority: HouseholdAuthority;
  isWorkerBee: boolean;
};

export type UserAuthContext = {
  isAdmin: boolean;
  schedulingToolsEnabled: boolean;
  household: HouseholdAuthContext | null;
};

export function isSystemAdmin(user: UserAuthContext): boolean {
  return user.isAdmin || user.household?.authority === "admin";
}

export function canUseSchedulingTools(user: UserAuthContext): boolean {
  if (isSystemAdmin(user)) return true;
  const h = user.household;
  if (!h || h.isWorkerBee) return false;
  return h.authority === "coordinator" && user.schedulingToolsEnabled;
}

export function hasCoordinatorHouseholdTier(user: UserAuthContext): boolean {
  const h = user.household;
  return Boolean(h && !h.isWorkerBee && h.authority === "coordinator");
}
