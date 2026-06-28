import { api } from "./api";
import { occupancyPickToApi, type OccupancyPick } from "./occupancy-choice";

type SubmitDraftWeekPickParams = {
  periodId: string;
  turnId: string;
  periodWeekId: string;
  occupancy: OccupancyPick;
  pendingWeekId?: string | null;
};

/** Pick and confirm a week in one user action (pickWeek → confirmPick, or changePick → confirmPick). */
export async function submitDraftWeekPick({
  periodId,
  turnId,
  periodWeekId,
  occupancy,
  pendingWeekId,
}: SubmitDraftWeekPickParams) {
  const occ = occupancyPickToApi(occupancy);

  if (pendingWeekId === periodWeekId) {
    return api.confirmPick(periodId, turnId, occ);
  }
  if (pendingWeekId) {
    await api.changePick(periodId, turnId, periodWeekId);
    return api.confirmPick(periodId, turnId, occ);
  }
  await api.pickWeek(periodId, turnId, periodWeekId);
  return api.confirmPick(periodId, turnId, occ);
}
