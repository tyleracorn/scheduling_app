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
  rounds_per_household: number;
  periods_to_schedule: number;
  week_start_day: number;
  draft_start_lead_days: number;
  generation_mode: "incremental" | "grid";
  last_period_end: string | null;
  next_period_start: string | null;
  has_blocking_periods: boolean;
};

export type PeriodPlanPreviewWeek = {
  start_date: string;
  end_date: string;
  span_days: number;
  kind: "bridge" | "merged" | "normal";
};

export type PeriodPlanPreview = {
  generation_mode: "incremental" | "grid";
  next_period_start: string | null;
  last_period_end: string | null;
  periods: {
    name: string;
    start_date: string;
    end_date: string;
    week_count: number;
    weeks: PeriodPlanPreviewWeek[];
  }[];
  would_create: number;
  requested: number;
  error: string | null;
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
    period_week_id: string | null;
    pending_pick: boolean;
    pending_week: {
      period_week_id: string;
      week_start_date: string;
      week_end_date: string;
    } | null;
  } | null;
  available_weeks: {
    period_week_id: string;
    week_start_date: string;
    week_end_date: string;
  }[];
  open_weeks: {
    period_week_id: string;
    week_start_date: string;
    week_end_date: string;
  }[];
  turns: {
    id: string;
    round: number;
    household_id: string;
    household_name: string;
    status: string;
    action: string | null;
    period_week_id: string | null;
    week_start_date: string | null;
    week_end_date: string | null;
  }[];
};
