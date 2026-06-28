import type { CalendarNote, CalendarResponse, OccupancyIndicator } from "./calendar-types";
import type { DraftState, Period, PeriodPlan } from "./period-types";

export type SystemSettings = {
  week_selections_per_household: number;
  pick_window_days: number;
  pick_warning_lead_days: number;
  history_retention_years: number;
};

export type AdminSettings = SystemSettings & {
  household_slot_count: number;
  max_coordinator_households: number;
  draft_start_lead_days: number;
};

export type NoteCategory = {
  id: string;
  name: string;
  slug: string;
  color: string;
  active: boolean;
  sort_order: number;
};

export type HouseholdAuthority = "active" | "coordinator" | "admin";

export type PeriodAssignmentSummary = {
  period_id: string;
  period_name: string;
  status: string;
  total_weeks: number;
  assigned_weeks: number;
  unassigned_weeks: number;
  draft_picks_per_household: number;
  even_split_hint: number | null;
  households: {
    household_id: string;
    household_name: string;
    color: string;
    is_worker_bee: boolean;
    weeks_assigned: number;
    draft_pick_target: number | null;
  }[];
};

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};
export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  isCoordinator: boolean;
  householdAuthority: HouseholdAuthority | null;
  schedulingToolsEnabled: boolean;
  canToggleSchedulingTools: boolean;
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
  updateProfile: (display_name: string) =>
    request<{ user: AuthUser }>("/api/v1/me", {
      method: "PATCH",
      body: JSON.stringify({ display_name }),
    }),
  updateSchedulingTools: (enabled: boolean) =>
    request<{ user: AuthUser }>("/api/v1/me/scheduling-tools", {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  changePassword: (current_password: string, new_password: string) =>
    request<{ ok: boolean }>("/api/v1/me/password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),
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
  getInvitePreview: (token: string) =>
    request<{
      invite: { email: string; household_name: string; expires_at: string };
    }>(`/api/v1/auth/invite?token=${encodeURIComponent(token)}`),
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
    request<{
      households: {
        id: string;
        name: string;
        color: string;
        active: boolean;
        is_worker_bee: boolean;
      }[];
    }>("/api/v1/households"),
  adminHouseholds: () =>
    request<{
      households: {
        id: string;
        name: string;
        color: string;
        active: boolean;
        is_worker_bee: boolean;
        is_coordinator: boolean;
        authority: HouseholdAuthority;
      }[];
    }>("/api/v1/admin/households"),
  syncHouseholds: () =>
    request<{
      households: {
        id: string;
        name: string;
        color: string;
        active: boolean;
        is_worker_bee: boolean;
        is_coordinator: boolean;
        authority: HouseholdAuthority;
      }[];
    }>(
      "/api/v1/admin/households/sync",
      { method: "POST", body: JSON.stringify({}) },
    ),
  adminSettings: () => request<{ settings: AdminSettings }>("/api/v1/admin/settings"),
  updateAdminSettings: (settings: Partial<AdminSettings>) =>
    request<{ settings: AdminSettings }>("/api/v1/admin/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  updateAdminHousehold: (
    id: string,
    data: Partial<{
      name: string;
      color: string;
      active: boolean;
      is_worker_bee: boolean;
      is_coordinator: boolean;
      authority: HouseholdAuthority;
    }>,
  ) =>
    request<{
      household: {
        id: string;
        name: string;
        color: string;
        active: boolean;
        is_worker_bee: boolean;
        is_coordinator: boolean;
        authority: HouseholdAuthority;
      };
    }>(
      `/api/v1/admin/households/${id}`,
      { method: "PATCH", body: JSON.stringify(data) },
    ),
  inviteUser: (email: string, household_id: string) =>
    request<{
      invite: {
        id: string;
        email: string;
        expires_at: string;
        household_name: string;
        invite_link: string;
      };
    }>("/api/v1/admin/users/invite", {
      method: "POST",
      body: JSON.stringify({ email, household_id }),
    }),
  adminInvites: () =>
    request<{
      invites: {
        id: string;
        email: string;
        household_name: string;
        expires_at: string;
        created_at: string;
      }[];
    }>("/api/v1/admin/invites"),
  regenerateInviteLink: (id: string) =>
    request<{
      invite: {
        id: string;
        email: string;
        expires_at: string;
        household_name: string;
        invite_link: string;
      };
    }>(`/api/v1/admin/invites/${id}/regenerate`, { method: "POST" }),
  adminUsers: () =>
    request<{
      users: {
        id: string;
        email: string;
        display_name: string;
        is_admin: boolean;
        active: boolean;
        household_id: string | null;
        household_name: string | null;
        household_is_coordinator: boolean;
      }[];
    }>("/api/v1/admin/users"),
  updateAdminUser: (
    id: string,
    data: Partial<{ active: boolean; household_id: string }>,
  ) =>
    request<{ user: { id: string; email: string; active: boolean } }>(
      `/api/v1/admin/users/${id}`,
      { method: "PATCH", body: JSON.stringify(data) },
    ),
  adminAudit: (params?: { limit?: number; entity_type?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.entity_type) q.set("entity_type", params.entity_type);
    const qs = q.toString();
    return request<{
      events: {
        id: string;
        event_type: string;
        entity_type: string;
        entity_id: string;
        actor: { id: string; email: string; display_name: string };
        before: unknown;
        after: unknown;
        reason: string | null;
        created_at: string;
      }[];
    }>(`/api/v1/admin/audit${qs ? `?${qs}` : ""}`);
  },
  adminEmailStatus: () =>
    request<{
      email: {
        configured: boolean;
        mode: "smtp" | "dev";
        host: string | null;
        port: number;
        from: string;
        has_auth: boolean;
      };
    }>("/api/v1/admin/email/status"),
  adminEmailTest: () =>
    request<{ ok: boolean; sent_to: string }>("/api/v1/admin/email/test", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  calendar: (start: string, end: string) =>
    request<CalendarResponse>(`/api/v1/calendar?start=${start}&end=${end}`),
  notes: (start: string, end: string) =>
    request<{ notes: CalendarNote[] }>(`/api/v1/notes?start=${start}&end=${end}`),
  noteCategories: () =>
    request<{
      categories: { id: string; name: string; slug: string; color: string; sort_order: number }[];
    }>("/api/v1/note-categories"),
  createNote: (data: {
    start_date: string;
    end_date: string;
    body: string;
    category_id?: string | null;
  }) =>
    request<{ note: CalendarNote }>("/api/v1/notes", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNote: (
    id: string,
    data: {
      start_date: string;
      end_date: string;
      body: string;
      category_id?: string | null;
    },
  ) =>
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
  setDayOccupancy: (date: string, status: "green" | "red" | null) =>
    request<{ ok: boolean }>("/api/v1/occupancy/day", {
      method: "PUT",
      body: JSON.stringify({ date, status }),
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
    rounds_per_household: number;
    periods_to_schedule: number;
    week_start_day: number;
    draft_start_lead_days: number;
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
  previewPeriodPlan: () =>
    request<{
      periods: {
        name: string;
        start_date: string;
        end_date: string;
        week_count: number;
        skipped: boolean;
        skip_reason: string | null;
      }[];
      would_create: number;
      requested: number;
    }>("/api/v1/periods/plan/preview", { method: "POST", body: JSON.stringify({}) }),
  deletePeriod: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/periods/${id}`, { method: "DELETE" }),
  resetPeriod: (id: string) =>
    request<{ ok: boolean; status: string }>(`/api/v1/periods/${id}/reset`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  periods: (params?: { status?: string; year?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set("status", params.status);
    if (params?.year) q.set("year", String(params.year));
    const qs = q.toString();
    return request<{ periods: Period[] }>(`/api/v1/periods${qs ? `?${qs}` : ""}`);
  },
  period: (id: string) => request<{ period: Period }>(`/api/v1/periods/${id}`),
  exportPeriod: async (id: string, filename?: string) => {
    const res = await fetch(`/api/v1/periods/${id}/export`, { credentials: "include" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as ApiError;
      throw new Error(body.error?.message ?? body.message ?? "Export failed");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? `period-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
  adminNoteCategories: () =>
    request<{ categories: NoteCategory[] }>("/api/v1/admin/note-categories"),
  createNoteCategory: (data: {
    name: string;
    slug?: string;
    color?: string;
    active?: boolean;
    sort_order?: number;
  }) =>
    request<{ category: NoteCategory }>("/api/v1/admin/note-categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateNoteCategory: (
    id: string,
    data: Partial<{ name: string; slug: string; color: string; active: boolean; sort_order: number }>,
  ) =>
    request<{ category: NoteCategory }>(`/api/v1/admin/note-categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  createPeriod: (data: {
    name: string;
    start_date: string;
    end_date: string;
    opening_at?: string;
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
  changePick: (periodId: string, turnId: string, period_week_id: string) =>
    request<{ draft: DraftState }>(`/api/v1/periods/${periodId}/turns/${turnId}/change-pick`, {
      method: "POST",
      body: JSON.stringify({ period_week_id }),
    }),
  confirmPick: (periodId: string, turnId: string, occupancy_status?: "green" | "red") =>
    request<{ draft: DraftState }>(`/api/v1/periods/${periodId}/turns/${turnId}/confirm-pick`, {
      method: "POST",
      body: JSON.stringify(occupancy_status ? { occupancy_status } : {}),
    }),
  revisePick: (
    periodId: string,
    turnId: string,
    period_week_id: string | null,
    occupancy_status?: "green" | "red" | null,
  ) =>
    request<{ draft: DraftState }>(`/api/v1/periods/${periodId}/turns/${turnId}/revise-pick`, {
      method: "POST",
      body: JSON.stringify({
        period_week_id,
        ...(occupancy_status !== undefined ? { occupancy_status } : {}),
      }),
    }),
  unassignedWeeks: (periodId: string) =>
    request<{
      period_id: string;
      period_name: string;
      status: string;
      weeks: { period_week_id: string; week_start_date: string; week_end_date: string }[];
    }>(`/api/v1/periods/${periodId}/assignments/unassigned`),
  assignWeek: (
    periodId: string,
    weekId: string,
    household_id: string,
    reason?: string,
    occupancy_status?: "green" | "red" | null,
  ) =>
    request<{ assignment: Record<string, unknown> }>(
      `/api/v1/periods/${periodId}/assignments/${weekId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          household_id,
          ...(reason ? { reason } : {}),
          ...(occupancy_status !== undefined ? { occupancy_status } : {}),
        }),
      },
    ),
  assignedWeeks: (periodId: string) =>
    request<{
      period_id: string;
      period_name: string;
      status: string;
      weeks: {
        period_week_id: string;
        week_start_date: string;
        week_end_date: string;
        household_id: string;
        household_name: string;
      }[];
    }>(`/api/v1/periods/${periodId}/assignments/assigned`),
  assignmentSummary: (periodId: string) =>
    request<PeriodAssignmentSummary>(`/api/v1/periods/${periodId}/assignments/summary`),
  swapWeeks: (
    periodId: string,
    data: {
      week_a_id: string;
      week_b_id: string;
      occupancy_a?: "green" | "red" | null;
      occupancy_b?: "green" | "red" | null;
      reason?: string;
    },
  ) =>
    request<{ ok: boolean }>(`/api/v1/periods/${periodId}/assignments/swap`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  publishPeriod: (periodId: string) =>
    request<{ period: { id: string; name: string; status: string; published_at: string } }>(
      `/api/v1/periods/${periodId}/publish`,
      { method: "POST", body: JSON.stringify({}) },
    ),
  systemSettings: () => request<{ settings: SystemSettings }>("/api/v1/settings"),
  notifications: (cursor?: string) => {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    return request<{ notifications: NotificationItem[]; next_cursor: string | null }>(
      `/api/v1/notifications${qs}`,
    );
  },
  notificationUnreadCount: () => request<{ count: number }>("/api/v1/notifications/unread-count"),
  markNotificationRead: (id: string) =>
    request<{ ok: boolean }>(`/api/v1/notifications/${id}/read`, { method: "POST", body: JSON.stringify({}) }),
  markAllNotificationsRead: () =>
    request<{ ok: boolean }>("/api/v1/notifications/read-all", { method: "POST", body: JSON.stringify({}) }),
  coordinatorPick: (
    periodId: string,
    turnId: string,
    period_week_id: string,
    occupancy_status?: "green" | "red",
  ) =>
    request<{ draft: DraftState }>(
      `/api/v1/periods/${periodId}/turns/${turnId}/coordinator-pick`,
      {
        method: "POST",
        body: JSON.stringify({
          period_week_id,
          ...(occupancy_status ? { occupancy_status } : {}),
        }),
      },
    ),
};
