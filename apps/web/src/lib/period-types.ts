export type PeriodWeek = {
  id: string;
  week_start_date: string;
  week_end_date: string;
  sort_order: number;
};

export type PeriodPriority = {
  household_id: string;
  household_name: string;
  position: number;
};

export type PeriodPlan = {
  first_week_start: string | null;
  weeks_per_period: number;
  open_lead_days: number;
  rounds_per_household: number;
  periods_to_schedule: number;
  week_start_day: number;
};

export type Period = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  opening_at: string;
  status: string;
  draft_started_at: string | null;
  published_at: string | null;
  draft_on_hold: boolean;
  consecutive_auto_skips: number;
  current_round: number;
  weeks?: PeriodWeek[];
  priorities?: PeriodPriority[];
};

export type DraftState = {
  period_id: string;
  period_name: string;
  status: string;
  on_hold: boolean;
  consecutive_auto_skips: number;
  current_round: number;
  max_rounds: number;
  active_turn: {
    id: string;
    household_id: string;
    household_name: string;
    expires_at: string | null;
    round: number;
  } | null;
  available_weeks: {
    period_week_id: string;
    week_start_date: string;
    week_end_date: string;
  }[];
  turns: {
    id: string;
    round: number;
    household_id: string;
    status: string;
    action: string | null;
    period_week_id: string | null;
  }[];
};
