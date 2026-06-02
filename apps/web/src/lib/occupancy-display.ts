import type { OccupancyIndicator } from "./calendar-types";
import type { OccupancyDisplayStrength } from "./preferences";

export type OccupancyCellChrome = {
  cellClass: string;
  pillClass: string;
  showLabels: boolean;
  maxPills: number;
};

/** Calendar cell styling from occupancy indicators and display preference. */
export function occupancyCellChrome(
  strength: OccupancyDisplayStrength,
  items: OccupancyIndicator[],
): OccupancyCellChrome {
  const base = { showLabels: false, maxPills: 4 };
  if (items.length === 0) {
    return { cellClass: "", pillClass: "", ...base };
  }

  const hasRed = items.some((o) => o.status === "red");
  const dominant = hasRed ? "red" : "green";

  if (strength === "subtle") {
    return {
      cellClass: dominant === "red" ? "ring-1 ring-inset ring-red-300/70" : "ring-1 ring-inset ring-green-300/70",
      pillClass: "h-1.5 w-1.5 rounded-full shrink-0",
      maxPills: 3,
      showLabels: false,
    };
  }

  if (strength === "strong") {
    return {
      cellClass:
        dominant === "red"
          ? "ring-2 ring-inset ring-red-500/80 bg-red-50/90"
          : "ring-2 ring-inset ring-green-500/80 bg-green-50/90",
      pillClass: "text-[9px] leading-tight font-semibold rounded px-1 py-0.5 truncate max-w-full",
      maxPills: 4,
      showLabels: true,
    };
  }

  // standard (default)
  return {
    cellClass:
      dominant === "red"
        ? "ring-2 ring-inset ring-red-400/75 bg-red-50/70"
        : "ring-2 ring-inset ring-green-400/75 bg-green-50/70",
    pillClass: "text-[8px] leading-tight font-medium rounded px-0.5 truncate max-w-full",
    maxPills: 4,
    showLabels: true,
  };
}

export function occupancyPillClass(status: "green" | "red", strength: OccupancyDisplayStrength): string {
  if (strength === "subtle") {
    return status === "green" ? "bg-green-500" : "bg-red-500";
  }
  return status === "green"
    ? "bg-green-600 text-white"
    : "bg-red-600 text-white";
}
