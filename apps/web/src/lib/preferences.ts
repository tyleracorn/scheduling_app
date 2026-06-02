const OCCUPANCY_MODE_KEY = "cabin_occupancy_default_mode";
const LEGACY_OCCUPANCY_KEY = "cabin_occupancy_default";
const OCCUPANCY_DISPLAY_KEY = "cabin_occupancy_display_strength";

export type OccupancyStatus = "green" | "red";

/** How new occupancy ranges are pre-filled when you add them. */
export type OccupancyDefaultMode = "green" | "red" | "none";

/** How strongly occupancy shows on calendar day cells (browser preference). */
export type OccupancyDisplayStrength = "subtle" | "standard" | "strong";

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

export function getOccupancyDisplayStrength(): OccupancyDisplayStrength {
  try {
    const v = localStorage.getItem(OCCUPANCY_DISPLAY_KEY);
    if (v === "subtle" || v === "standard" || v === "strong") return v;
  } catch {
    /* ignore */
  }
  return "standard";
}

export function setOccupancyDisplayStrength(strength: OccupancyDisplayStrength): void {
  try {
    localStorage.setItem(OCCUPANCY_DISPLAY_KEY, strength);
  } catch {
    /* ignore */
  }
}
