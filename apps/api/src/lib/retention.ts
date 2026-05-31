/** Earliest civil date (UTC) still visible for notes/occupancy per admin retention setting. */
export function retentionCutoffDate(retentionYears: number): Date {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - retentionYears);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
