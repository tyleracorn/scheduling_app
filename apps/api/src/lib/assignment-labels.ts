import type { AssignmentSource } from "@prisma/client";

/** Plain-language label for how a week was assigned (CSV export and UI). */
export function formatHowAssigned(source: AssignmentSource | null | undefined): string {
  if (!source) return "";
  switch (source) {
    case "draft_pick":
      return "Draft pick";
    case "household_swap":
      return "Swap";
    case "coordinator_manual":
      return "Coordinator assigned";
    case "coordinator_edit":
      return "Coordinator updated";
    default:
      return source;
  }
}
