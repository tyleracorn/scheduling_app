import { getAutoOccupancyStatus, type OccupancyStatus } from "./preferences";

/** User-facing occupancy choice when picking or assigning a week. */
export type OccupancyPick = "green" | "red" | "none";

export function defaultOccupancyPick(): OccupancyPick {
  const auto = getAutoOccupancyStatus();
  if (auto === "green" || auto === "red") return auto;
  return "none";
}

export function occupancyPickToApi(pick: OccupancyPick): OccupancyStatus | undefined {
  if (pick === "none") return undefined;
  return pick;
}
