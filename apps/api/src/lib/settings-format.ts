import type { SystemSettings } from "@prisma/client";

const HOURS_PER_DAY = 24;

export function pickWindowHoursFromDays(days: number): number {
  return days * HOURS_PER_DAY;
}

export function pickWarningLeadHoursFromDays(days: number): number {
  return days * HOURS_PER_DAY;
}

/** Public settings for API (no timezone — fixed at cabin). */
export function formatSystemSettingsForApi(settings: SystemSettings) {
  return {
    week_start_day: settings.weekStartDay,
    week_selections_per_household: settings.weekSelectionsPerHousehold,
    pick_window_days: Math.max(1, Math.round(settings.pickWindowHours / HOURS_PER_DAY)),
    pick_warning_lead_days: Math.max(
      0,
      Math.round(settings.pickWarningLeadHours / HOURS_PER_DAY),
    ),
    history_retention_years: settings.historyRetentionYears,
  };
}
