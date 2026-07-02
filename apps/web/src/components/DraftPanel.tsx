import type { AuthUser } from "../lib/api";
import type { CalendarPeriod } from "../lib/calendar-types";
import type { CalendarViewMode } from "../lib/calendar-view-mode";
import type { OccupancyPick } from "../lib/occupancy-choice";
import { DraftWeekPickForm } from "./DraftWeekPickForm";

type Props = {
  period: CalendarPeriod;
  user: AuthUser;
  viewMode: CalendarViewMode;
  onChanged: () => void;
  onDraftAction?: () => void;
  refreshToken?: number;
  embedded?: boolean;
  pickOccupancy: OccupancyPick;
  onPickOccupancyChange: (value: OccupancyPick) => void;
  coordOccupancy: OccupancyPick;
  onCoordOccupancyChange: (value: OccupancyPick) => void;
  preferredWeekId?: string | null;
};

export function DraftPanel({
  period,
  user,
  viewMode,
  onChanged,
  onDraftAction,
  refreshToken,
  embedded = false,
  pickOccupancy,
  onPickOccupancyChange,
  coordOccupancy,
  onCoordOccupancyChange,
  preferredWeekId = null,
}: Props) {
  const panelClass = embedded
    ? "text-sm text-indigo-950 pt-2 border-t border-slate-200"
    : "mb-4 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-4 text-sm text-indigo-950";

  return (
    <div className={panelClass}>
      <DraftWeekPickForm
        period={period}
        user={user}
        viewMode={viewMode}
        onChanged={onChanged}
        onDraftAction={onDraftAction}
        refreshToken={refreshToken}
        embedded={embedded}
        pickOccupancy={pickOccupancy}
        onPickOccupancyChange={onPickOccupancyChange}
        coordOccupancy={coordOccupancy}
        onCoordOccupancyChange={onCoordOccupancyChange}
        preferredWeekId={preferredWeekId}
        showHeading={!embedded}
      />
    </div>
  );
}
