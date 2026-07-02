/** True when a period ends on or before the next period starts (shared handoff day counts). */
export function periodQualifiesAsPredecessor(periodEnd: Date, nextPeriodStart: Date): boolean {
  return periodEnd.getTime() <= nextPeriodStart.getTime();
}

export function rotateHouseholdOrder(orderedIds: string[], lastPickerId: string): string[] {
  const idx = orderedIds.indexOf(lastPickerId);
  if (idx === -1 || orderedIds.length === 0) return [...orderedIds];
  return [...orderedIds.slice(idx), ...orderedIds.slice(0, idx)];
}

/** Append any active households missing from the rotated list (at the end). */
export function mergeNewHouseholds(rotatedIds: string[], allActiveIds: string[]): string[] {
  const seen = new Set(rotatedIds);
  const merged = [...rotatedIds];
  for (const id of allActiveIds) {
    if (!seen.has(id)) {
      merged.push(id);
      seen.add(id);
    }
  }
  return merged;
}

/** Build position rows from an ordered household id list. */
export function prioritiesFromOrder(
  householdIds: string[],
): { household_id: string; position: number }[] {
  return householdIds.map((household_id, i) => ({
    household_id,
    position: i + 1,
  }));
}
