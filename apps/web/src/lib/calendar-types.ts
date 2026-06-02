export type CalendarAssignment = {
  household_id: string;
  household_name: string;
  color: string;
  source: string;
  updated_at: string;
};

export type CalendarWeek = {
  period_week_id: string;
  period_id: string;
  period_name: string;
  period_status: string;
  week_start_date: string;
  week_end_date: string;
  assignment: CalendarAssignment | null;
};

export type CalendarPeriod = {
  id: string;
  name: string;
  status: string;
  start_date?: string;
  end_date?: string;
  draft_summary?: {
    current_round: number;
    on_hold: boolean;
    active_turn: {
      household_id: string;
      household_name: string;
      expires_at: string | null;
    } | null;
  };
};

export type CalendarNote = {
  id: string;
  household_id: string;
  household_name: string;
  start_date: string;
  end_date: string;
  body: string;
};

export type OccupancyIndicator = {
  id: string;
  household_id: string;
  household_name: string;
  start_date: string;
  end_date: string;
  status: "green" | "red";
};

export type CalendarResponse = {
  range: { start: string; end: string };
  settings: {
    cabin_timezone: string;
    week_start_day: number;
    notes_earliest_date: string;
  };
  periods: CalendarPeriod[];
  weeks: CalendarWeek[];
  notes: CalendarNote[];
  occupancy: OccupancyIndicator[];
};
