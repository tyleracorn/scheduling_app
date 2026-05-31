import type { CalendarResponse } from "./calendar-types";

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
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
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
};
