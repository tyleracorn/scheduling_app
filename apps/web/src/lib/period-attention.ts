import type { AuthUser } from "./api";
import type { CalendarPeriod } from "./calendar-types";
import type { CalendarViewMode } from "./calendar-view-mode";

export function periodShouldExpand(
  period: CalendarPeriod,
  user: AuthUser | null,
  mode: CalendarViewMode = "coordinator",
): boolean {
  if (!user || mode !== "coordinator") return false;
  const isCoordinator = user.isCoordinator || user.isAdmin;

  if (period.status === "published" || period.status === "archived") return false;

  if (period.status === "draft") {
    const summary = period.draft_summary;
    if (summary?.on_hold && isCoordinator) return true;
    if (isCoordinator && summary?.active_turn) return true;
    return false;
  }

  if (period.status === "assignment") return isCoordinator;

  return false;
}

export function getPeriodAttentionMessage(
  period: CalendarPeriod,
  user: AuthUser | null,
  mode: CalendarViewMode = "member",
): string | null {
  if (!user) return null;
  const isCoordinator = user.isCoordinator || user.isAdmin;
  const summary = period.draft_summary;

  if (mode === "member") {
    if (period.status === "draft" && summary?.active_turn) {
      if (summary.active_turn.household_id === user.householdId) {
        return `${period.name}: Your turn — tap an open week`;
      }
      return `${period.name}: Waiting for ${summary.active_turn.household_name}`;
    }
    return null;
  }

  if (period.status === "draft") {
    if (summary?.on_hold && isCoordinator) {
      return `${period.name}: Coordinator action needed`;
    }
    if (summary?.active_turn?.household_id === user.householdId) {
      return `${period.name}: Your household's turn — pick on Calendar`;
    }
    if (summary?.active_turn) {
      return `${period.name}: ${summary.active_turn.household_name}'s turn`;
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
