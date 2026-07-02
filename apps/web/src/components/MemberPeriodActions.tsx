import type { AuthUser } from "../lib/api";
import type { CalendarPeriod } from "../lib/calendar-types";
import type { OccupancyPick } from "../lib/occupancy-choice";
import { DraftWeekPickForm } from "./DraftWeekPickForm";

type Props = {
  periods: CalendarPeriod[];
  user: AuthUser;
  onChanged: () => void;
  onDraftAction?: () => void;
  refreshToken: number;
  pickOccupancy: OccupancyPick;
  onPickOccupancyChange: (value: OccupancyPick) => void;
  preferredWeekId?: string | null;
  preferredPeriodId?: string | null;
};

/** Below-calendar draft pick strip for members when it's their household's turn. */
export function MemberPeriodActions({
  periods,
  user,
  onChanged,
  onDraftAction,
  refreshToken,
  pickOccupancy,
  onPickOccupancyChange,
  preferredWeekId = null,
  preferredPeriodId = null,
}: Props) {
  const activePeriod = periods.find(
    (p) =>
      p.status === "draft" &&
      p.draft_summary?.active_turn?.household_id === user.householdId &&
      !p.draft_summary.on_hold,
  );

  if (!activePeriod || !user.householdId) return null;

  const syncedWeekId =
    preferredWeekId && preferredPeriodId === activePeriod.id ? preferredWeekId : null;

  return (
    <div className="mb-3 sm:mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-3 sm:px-4 py-3 sm:py-4 text-sm text-indigo-950">
      <DraftWeekPickForm
        period={activePeriod}
        user={user}
        viewMode="member"
        onChanged={onChanged}
        onDraftAction={onDraftAction}
        refreshToken={refreshToken}
        pickOccupancy={pickOccupancy}
        onPickOccupancyChange={onPickOccupancyChange}
        coordOccupancy={pickOccupancy}
        onCoordOccupancyChange={() => {}}
        preferredWeekId={syncedWeekId}
        showHeading
      />
    </div>
  );
}
