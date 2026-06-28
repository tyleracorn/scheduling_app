import { addDays, parseDateString } from "./dates.js";

/** When auto-draft should start: period start minus lead days at 15:00 UTC. */
export function computeDraftStartAt(periodStart: Date, draftStartLeadDays: number): Date {
  const openDate = addDays(periodStart, -draftStartLeadDays);
  return new Date(
    Date.UTC(
      openDate.getUTCFullYear(),
      openDate.getUTCMonth(),
      openDate.getUTCDate(),
      15,
      0,
      0,
    ),
  );
}

export function computeDraftStartAtFromString(
  startDate: string,
  draftStartLeadDays: number,
): Date {
  return computeDraftStartAt(parseDateString(startDate), draftStartLeadDays);
}
