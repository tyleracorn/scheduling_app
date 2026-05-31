const OCCUPANCY_MODE_KEY = "cabin_occupancy_default_mode";
const LEGACY_OCCUPANCY_KEY = "cabin_occupancy_default";

export type OccupancyStatus = "green" | "red";

/** How new occupancy ranges are pre-filled when you add them. */
export type OccupancyDefaultMode = "green" | "red" | "none";

export function getOccupancyDefaultMode(): OccupancyDefaultMode {
  try {
    const v = localStorage.getItem(OCCUPANCY_MODE_KEY);
    if (v === "green" || v === "red" || v === "none") return v;
    const legacy = localStorage.getItem(LEGACY_OCCUPANCY_KEY);
    if (legacy === "green" || legacy === "red") {
      setOccupancyDefaultMode(legacy);
      return legacy;
    }
  } catch {
    /* ignore */
  }
  return "green";
}

export function setOccupancyDefaultMode(mode: OccupancyDefaultMode): void {
  try {
    localStorage.setItem(OCCUPANCY_MODE_KEY, mode);
    localStorage.removeItem(LEGACY_OCCUPANCY_KEY);
  } catch {
    /* ignore */
  }
}

/** Status applied automatically when adding occupancy; null = you must choose each time. */
export function getAutoOccupancyStatus(): OccupancyStatus | null {
  const mode = getOccupancyDefaultMode();
  if (mode === "none") return null;
  return mode;
}
