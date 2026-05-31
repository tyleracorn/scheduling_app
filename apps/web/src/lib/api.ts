import type { CalendarNote, CalendarResponse, OccupancyIndicator } from "./calendar-types";
import type { DraftState, Period, PeriodPlan } from "./period-types";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  isCoordinator: boolean;
  householdId: string | null;
  householdName: string | null;
};

type ApiError = { error?: { code: string; message: string; details?: unknown }; message?: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && init.body !== "" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers,
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as ApiError;
  if (!res.ok) {
    const message =
      body.error?.message ??
      body.message ??
      `Request failed (${res.status}) for ${path}. Is the API running on port 3000?`;
    throw new Error(message);
  }
  return body as T;
}

export const api = {
  me: () => request<{ user: AuthUser }>("/api/v1/auth/me"),
  login: (email: string, password: string) =>
    request<{ ok: boolean }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<void>("/api/v1/auth/logout", { method: "POST" }),
  acceptInvite: (token: string, password: string, display_name: string) =>
    request<{ ok: boolean }>("/api/v1/auth/accept-invite", {
      method: "POST",
      body: JSON.stringify({ token, password, display_name }),
    }),
  forgotPassword: (email: string) =>
    request<{ ok: boolean; message: string }>("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ ok: boolean }>("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  households: () =>
    request<{ households: { id: string; name: string; color: string; active: boolean }[] }>(
      "/api/v1/admin/households",
    ),
  inviteUser: (email: string, household_id: string) =>
    request<{ invite: { id: string; email: string; expires_at: string } }>(
      "/api/v1/admin/users/invite",
      { method: "POST", body: JSON.stringify({ email, household_id }) },
    ),
  calendar: (start: string, end: string) =>
    request<CalendarResponse>(`/api/v1/calendar?start=${start}&end=${end}`),
  createNote: (data: { start_date: string; end_date: string; body: string }) =>
    request<{ note: CalendarNote }>("/api/v1/notes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNote: (id: string, data: { start_date: string; end_date: string; body: string }) =>
    request<{ note: CalendarNote }>(`/api/v1/notes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteNote: (id: string) => request<void>(`/api/v1/notes/${id}`, { method: "DELETE" }),
  createOccupancy: (data: { start_date: string; end_date: string; status: "green" | "red" }) =>
    request<{ occupancy: OccupancyIndicator }>("/api/v1/occupancy", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateOccupancy: (
    id: string,
    data: { start_date: string; end_date: string; status: "green" | "red" },
  ) =>
    request<{ occupancy: OccupancyIndicator }>(`/api/v1/occupancy/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteOccupancy: (id: string) =>
    request<void>(`/api/v1/occupancy/${id}`, { method: "DELETE" }),
  periodPlan: () => request<{ plan: PeriodPlan }>("/api/v1/periods/plan"),
  savePeriodPlan: (plan: {
    first_week_start: string;
    weeks_per_period: number;
    open_lead_days: number;
    rounds_per_household: number;
    periods_to_schedule: number;
    week_start_day: number;
  }) =>
    request<{ plan: PeriodPlan }>("/api/v1/periods/plan", {
      method: "PUT",
      body: JSON.stringify(plan),
    }),
  generatePeriods: (replace_unstarted?: boolean) =>
    request<{
      created: { id: string; name: string; start_date: string; end_date: string }[];
      skipped: string[];
    }>("/api/v1/periods/generate", {
      method: "POST",
      body: JSON.stringify({ replace_unstarted: replace_unstarted ?? false }),
    }),
  deletePeriod: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/periods/${id}`, { method: "DELETE" }),
  periods: (params?: { status?: string; year?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.year) q.set("year", String(params.year));
    const qs = q.toString();
    return request<{ periods: Period[] }>(`/api/v1/periods${qs ? `?${qs}` : ""}`);
  },
  period: (id: string) => request<{ period: Period }>(`/api/v1/periods/${id}`),
  createPeriod: (data: {
    name: string;
    start_date: string;
    end_date: string;
    opening_at: string;
  }) =>
    request<{ period: Period }>("/api/v1/periods", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updatePeriod: (
    id: string,
    data: Partial<{ name: string; start_date: string; end_date: string; opening_at: string }>,
  ) =>
    request<{ period: Period }>(`/api/v1/periods/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  setPeriodPriorities: (id: string, priorities: { household_id: string; position: number }[]) =>
    request<{ period: Period }>(`/api/v1/periods/${id}/priorities`, {
      method: "PUT",
      body: JSON.stringify({ priorities }),
    }),
  startDraft: (id: string) =>
    request<{ draft: DraftState }>(`/api/v1/periods/${id}/start-draft`, { method: "POST" }),
  draft: (id: string) => request<{ draft: DraftState }>(`/api/v1/periods/${id}/draft`),
  pickWeek: (periodId: string, turnId: string, period_week_id: string) =>
    request<{ draft: DraftState }>(`/api/v1/periods/${periodId}/turns/${turnId}/pick`, {
      method: "POST",
      body: JSON.stringify({ period_week_id }),
    }),
  skipTurn: (periodId: string, turnId: string) =>
    request<{ draft: DraftState }>(`/api/v1/periods/${periodId}/turns/${turnId}/skip`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  resumeDraft: (periodId: string, reset_auto_skip_counter = true) =>
    request<{ draft: DraftState }>(`/api/v1/periods/${periodId}/draft/resume`, {
      method: "POST",
      body: JSON.stringify({ reset_auto_skip_counter }),
    }),
  forceSkipTurn: (periodId: string, turnId: string) =>
    request<{ draft: DraftState }>(
      `/api/v1/periods/${periodId}/turns/${turnId}/force-skip`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  coordinatorPick: (periodId: string, turnId: string, period_week_id: string) =>
    request<{ draft: DraftState }>(
      `/api/v1/periods/${periodId}/turns/${turnId}/coordinator-pick`,
      { method: "POST", body: JSON.stringify({ period_week_id }) },
    ),
};
