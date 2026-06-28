import type { AuthUser } from "./api";
import type { CalendarPeriod } from "./calendar-types";

export function periodShouldExpand(period: CalendarPeriod, user: AuthUser | null): boolean {
  if (!user) return false;
  const isCoordinator = user.isCoordinator || user.isAdmin;

  if (period.status === "published" || period.status === "archived") return false;

  if (period.status === "draft") {
    const summary = period.draft_summary;
    if (summary?.on_hold && isCoordinator) return true;
    if (summary?.active_turn?.household_id === user.householdId) return true;
    if (isCoordinator && summary?.active_turn) return true;
    return false;
  }

  if (period.status === "assignment") return isCoordinator;

  return period.status !== "published";
}

export function getPeriodAttentionMessage(
  period: CalendarPeriod,
  user: AuthUser | null,
): string | null {
  if (!user) return null;
  const isCoordinator = user.isCoordinator || user.isAdmin;

  if (period.status === "draft") {
    const summary = period.draft_summary;
    if (summary?.on_hold && isCoordinator) {
      return `${period.name}: Coordinator action needed`;
    }
    if (summary?.active_turn?.household_id === user.householdId) {
      return `${period.name}: Your turn — click an open week or use Period activity`;
    }
    if (summary?.active_turn) {
      return `${period.name}: Waiting for ${summary.active_turn.household_name}`;
    }
  }

  if (period.status === "assignment" && isCoordinator) {
    return `${period.name}: Assign remaining weeks on the calendar`;
  }

  return null;
}

export function sidebarPeriods(periods: CalendarPeriod[]): CalendarPeriod[] {
  return periods.filter(
    (p) => p.status === "draft" || p.status === "assignment" || p.status === "published",
  );
}
