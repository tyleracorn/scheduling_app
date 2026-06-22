import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AdminSettings } from "../lib/api";

type Household = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  is_worker_bee: boolean;
  is_coordinator: boolean;
};

type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
  active: boolean;
  household_id: string | null;
  household_name: string | null;
  household_is_coordinator: boolean;
};

type AuditEvent = {
  id: string;
  event_type: string;
  entity_type: string;
  actor: { display_name: string; email: string };
  reason: string | null;
  created_at: string;
  after: unknown;
};

type EmailStatus = {
  configured: boolean;
  mode: "smtp" | "dev";
  host: string | null;
  port: number;
  from: string;
  has_auth: boolean;
};

type PendingInvite = {
  id: string;
  email: string;
  household_name: string;
  expires_at: string;
  created_at: string;
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const SECTIONS = [
  { id: "people", label: "People" },
  { id: "households", label: "Households" },
  { id: "system", label: "System" },
  { id: "email", label: "Email" },
  { id: "audit", label: "Audit" },
] as const;

function userRoleLabel(u: AdminUser) {
  if (u.is_admin) return "Admin";
  if (u.household_is_coordinator) return "Coordinator";
  return "Member";
}

export function AdminPage() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [slotCount, setSlotCount] = useState(5);
  const [systemForm, setSystemForm] = useState({
    pick_window_days: 3,
    pick_warning_lead_days: 1,
    history_retention_years: 3,
  });
  const [email, setEmail] = useState("");
  const [householdId, setHouseholdId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [hh, st, us, audit, emailRes, invitesRes] = await Promise.all([
        api.adminHouseholds(),
        api.adminSettings(),
        api.adminUsers(),
        api.adminAudit({ limit: 30 }),
        api.adminEmailStatus(),
        api.adminInvites(),
      ]);
      setHouseholds(hh.households);
      setSettings(st.settings);
      setSlotCount(st.settings.household_slot_count);
      setSystemForm({
        pick_window_days: st.settings.pick_window_days,
        pick_warning_lead_days: st.settings.pick_warning_lead_days,
        history_retention_years: st.settings.history_retention_years,
      });
      setUsers(us.users);
      setPendingInvites(invitesRes.invites);
      setAuditEvents(audit.events);
      setEmailStatus(emailRes.email);
      const inviteTargets = hh.households.filter((h) => h.active && !h.is_worker_bee);
      if (inviteTargets[0]) setHouseholdId(inviteTargets[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLastInviteLink(null);
    try {
      const res = await api.inviteUser(email, householdId);
      setLastInviteLink(res.invite.invite_link);
      if (emailStatus?.configured) {
        setMessage(`Invite email sent to ${res.invite.email}.`);
      } else {
        setMessage(
          `Invite created for ${res.invite.email}. Copy the link below and send it to them (email is not configured).`,
        );
      }
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    }
  }

  async function regenerateInvite(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.regenerateInviteLink(id);
      setLastInviteLink(res.invite.invite_link);
      if (emailStatus?.configured) {
        setMessage(`New invite link emailed to ${res.invite.email}.`);
      } else {
        setMessage(`New invite link for ${res.invite.email} — copy below and send it to them.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not regenerate link");
    } finally {
      setBusy(false);
    }
  }

  async function copyInviteLink(link: string, label: string) {
    const ok = await copyText(link);
    if (ok) {
      setMessage(`${label} copied to clipboard.`);
    } else {
      setError("Could not copy — select the link and copy manually.");
    }
  }

  async function saveSlotCount(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await api.updateAdminSettings({ household_slot_count: slotCount });
      setMessage(`Saved ${slotCount} owning household slots and synced households.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveSystemSettings(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api.updateAdminSettings(systemForm);
      setSettings(res.settings);
      setMessage("System settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function syncHouseholds() {
    setBusy(true);
    setError(null);
    try {
      await api.syncHouseholds();
      setMessage("Household slots synced.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendTestEmail() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await api.adminEmailTest();
      setMessage(`Test email sent to ${res.sent_to}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test email failed");
    } finally {
      setBusy(false);
    }
  }

  async function patchHousehold(id: string, data: Partial<Household>) {
    setBusy(true);
    setError(null);
    try {
      await api.updateAdminHousehold(id, {
        name: data.name,
        color: data.color,
        active: data.active,
        is_worker_bee: data.is_worker_bee,
        is_coordinator: data.is_coordinator,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function patchUser(id: string, data: Partial<{ active: boolean; household_id: string }>) {
    setBusy(true);
    setError(null);
    try {
      await api.updateAdminUser(id, data);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleUserActive(u: AdminUser) {
    if (u.active) {
      if (!confirm(`Deactivate ${u.email}? They will lose access but history is kept.`)) return;
    }
    await patchUser(u.id, { active: !u.active });
  }

  const inviteHouseholds = households.filter((h) => h.active && !h.is_worker_bee);
  const assignableHouseholds = households.filter((h) => h.active && !h.is_worker_bee);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-2">Administration</h1>
      <p className="text-slate-600 text-sm mb-4">
        Cabin setup: people, households, system defaults, and email delivery.
      </p>

      <nav
        aria-label="Admin sections"
        className="sticky top-0 z-10 -mx-2 px-2 py-2 mb-6 bg-slate-50/95 backdrop-blur border-b border-slate-200 flex flex-wrap gap-2 text-sm"
      >
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:bg-slate-100"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {error && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-green-700 mb-4" role="status">
          {message}
        </p>
      )}

      <section id="people" className="mb-10 scroll-mt-16">
        <h2 className="font-medium text-slate-800 mb-1">People</h2>
        <p className="text-xs text-slate-500 mb-4">
          Member households use the calendar and pick on their turn. Coordinator households can run
          periods and drafts — any active member inherits that access. Admin accounts manage cabin
          setup (login-specific). Mark up to three owning households as coordinator in Households
          below. New users join via an invite link — there is no open signup page.
        </p>

        {emailStatus && !emailStatus.configured && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            Email is not configured — invite links are shown here for you to copy and send manually
            (text, etc.). Configure SMTP under Email below when ready.
          </p>
        )}

        <form
          onSubmit={onInvite}
          className="space-y-4 bg-white p-5 rounded-lg border border-slate-200 mb-4"
        >
          <h3 className="text-sm font-medium text-slate-800">Invite user</h3>
          <p className="text-xs text-slate-500">
            Creates an account for this email and assigns them to a household. They open the invite
            link to choose a display name and password.
          </p>
          <label className="block text-sm">
            <span className="text-slate-600">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Household</span>
            <select
              value={householdId}
              onChange={(e) => setHouseholdId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            >
              {inviteHouseholds.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded bg-slate-800 text-white px-4 py-2 text-sm font-medium"
          >
            Send invite
          </button>
        </form>

        {lastInviteLink && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-sm font-medium text-slate-800">Invite link</p>
            <p className="text-xs text-slate-500">Send this to the invitee. Valid for 7 days.</p>
            <input
              readOnly
              value={lastInviteLink}
              className="w-full text-xs rounded border border-slate-300 bg-white px-2 py-2 font-mono"
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={() => void copyInviteLink(lastInviteLink, "Invite link")}
              className="text-sm rounded border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100"
            >
              Copy link
            </button>
          </div>
        )}

        {pendingInvites.length > 0 && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-medium text-slate-800 mb-2">Pending invites</h3>
            <ul className="space-y-3">
              {pendingInvites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="font-medium text-slate-800">{inv.email}</p>
                    <p className="text-xs text-slate-500">
                      {inv.household_name} · expires{" "}
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void regenerateInvite(inv.id)}
                    className="text-xs text-slate-600 underline hover:text-slate-900 disabled:opacity-40"
                  >
                    New link
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500 mt-3">
              Use &quot;New link&quot; if the invite was lost. Previous links stop working.
            </p>
          </div>
        )}

        <h3 className="text-sm font-medium text-slate-800 mb-3">Active users</h3>
        <ul className="space-y-3">
          {users.map((u) => (
            <li
              key={u.id}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-800">{u.display_name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">{userRoleLabel(u)}</span>
                  {!u.active && (
                    <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">Inactive</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-slate-600">
                  Household
                  <select
                    value={u.household_id ?? ""}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next) void patchUser(u.id, { household_id: next });
                    }}
                    className="mt-1 block rounded border border-slate-300 px-2 py-1.5 min-w-[10rem]"
                  >
                    <option value="">None</option>
                    {assignableHouseholds.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy || u.is_admin}
                  onClick={() => void toggleUserActive(u)}
                  className="text-xs text-slate-600 underline hover:text-slate-900 disabled:opacity-40"
                >
                  {u.active ? "Deactivate" : "Reactivate"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="households" className="mb-10 scroll-mt-16">
        <h2 className="font-medium text-slate-800 mb-1">Households</h2>
        <p className="text-xs text-slate-500 mb-4">
          Owning households share the draft. Worker Bee is separate — for group project weeks assigned
          by the coordinator. Mark coordinator households here (max 3); all active members get
          period and draft tools.
        </p>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm mb-4">
          <form onSubmit={(e) => void saveSlotCount(e)} className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Number of households
              <input
                type="number"
                min={1}
                max={20}
                value={slotCount}
                onChange={(e) => setSlotCount(parseInt(e.target.value, 10) || 1)}
                className="mt-1 block w-24 rounded border border-slate-300 px-2 py-1.5"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-slate-800 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Save & sync
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void syncHouseholds()}
              className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Sync slots
            </button>
          </form>
          {settings && (
            <p className="text-xs text-slate-400 mt-2">
              Current setting: {settings.household_slot_count} slots
            </p>
          )}
        </div>

        <ul className="space-y-3">
          {households.map((h) => (
            <li
              key={h.id}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm flex flex-wrap items-center gap-3"
            >
              <input
                type="color"
                value={h.color}
                onChange={(e) => void patchHousehold(h.id, { color: e.target.value })}
                className="w-8 h-8 rounded border border-slate-200 p-0.5"
                title="Color"
              />
              <input
                type="text"
                defaultValue={h.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== h.name) {
                    void patchHousehold(h.id, { name: e.target.value.trim() });
                  }
                }}
                className="flex-1 min-w-[8rem] rounded border border-slate-300 px-2 py-1"
              />
              {h.is_worker_bee ? (
                <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Worker Bee
                </span>
              ) : (
                <span className="text-xs text-slate-400">Owning</span>
              )}
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={h.active}
                  onChange={(e) => void patchHousehold(h.id, { active: e.target.checked })}
                />
                Active
              </label>
              {!h.is_worker_bee && (
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={h.is_coordinator}
                    onChange={(e) =>
                      void patchHousehold(h.id, { is_coordinator: e.target.checked })
                    }
                  />
                  Coordinator
                </label>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section id="system" className="mb-10 scroll-mt-16">
        <h2 className="font-medium text-slate-800 mb-1">System</h2>
        <p className="text-xs text-slate-500 mb-4">
          Draft timing and data retention defaults for the whole cabin.
        </p>
        <form
          onSubmit={(e) => void saveSystemSettings(e)}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3"
        >
          <label className="block text-sm">
            Pick window (days)
            <span className="block text-xs font-normal text-slate-500 mt-0.5 mb-1">
              How long each household has to pick or skip when it is their turn. After this many
              days the turn auto-skips.
            </span>
            <input
              type="number"
              min={1}
              max={14}
              disabled={busy}
              value={systemForm.pick_window_days}
              onChange={(e) =>
                setSystemForm((f) => ({
                  ...f,
                  pick_window_days: parseInt(e.target.value, 10) || 1,
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
            />
          </label>
          <label className="block text-sm">
            Pick warning lead (days)
            <span className="block text-xs font-normal text-slate-500 mt-0.5 mb-1">
              Days before a turn deadline to send a reminder email. Use 0 to disable.
            </span>
            <input
              type="number"
              min={0}
              max={7}
              disabled={busy}
              value={systemForm.pick_warning_lead_days}
              onChange={(e) =>
                setSystemForm((f) => ({
                  ...f,
                  pick_warning_lead_days: parseInt(e.target.value, 10) || 0,
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
            />
          </label>
          <label className="block text-sm">
            History retention (years)
            <input
              type="number"
              min={1}
              max={20}
              disabled={busy}
              value={systemForm.history_retention_years}
              onChange={(e) =>
                setSystemForm((f) => ({
                  ...f,
                  history_retention_years: parseInt(e.target.value, 10) || 1,
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 bg-white"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-50"
          >
            Save system settings
          </button>
        </form>
      </section>

      <section id="email" className="mb-10 scroll-mt-16">
        <h2 className="font-medium text-slate-800 mb-1">Email</h2>
        <p className="text-xs text-slate-500 mb-4">
          SMTP credentials are configured in the server environment (`.env` or Docker), not in this
          app. See <code className="text-xs bg-slate-100 px-1 rounded">docs/production-deployment.md</code>{" "}
          in the repository for NAS setup.
        </p>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          {emailStatus ? (
            <>
              <p className="text-sm">
                Status:{" "}
                <span
                  className={
                    emailStatus.configured
                      ? "font-medium text-green-800"
                      : "font-medium text-amber-800"
                  }
                >
                  {emailStatus.configured ? "Configured" : "Dev mode (console only)"}
                </span>
              </p>
              {emailStatus.host && (
                <p className="text-xs text-slate-600">
                  Host: {emailStatus.host}:{emailStatus.port}
                  {emailStatus.has_auth ? " (authenticated)" : ""}
                </p>
              )}
              <p className="text-xs text-slate-600">From: {emailStatus.from}</p>
              <button
                type="button"
                disabled={busy || !emailStatus.configured}
                onClick={() => void sendTestEmail()}
                className="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Send test email to me
              </button>
              {!emailStatus.configured && (
                <p className="text-xs text-slate-500">
                  Set SMTP_HOST (and related variables) on the API server, then restart the
                  container.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400">Loading email status…</p>
          )}
        </div>
      </section>

      <section id="audit" className="mb-8 scroll-mt-16">
        <h2 className="font-medium text-slate-800 mb-2">Assignment audit log</h2>
        <p className="text-xs text-slate-500 mb-3">Recent published assignment changes.</p>
        {auditEvents.length === 0 ? (
          <p className="text-sm text-slate-400">No audit events yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {auditEvents.map((e) => (
              <li key={e.id} className="rounded border border-slate-200 bg-white p-3">
                <p className="font-medium text-slate-800">{e.event_type.replace(/_/g, " ")}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {e.actor.display_name} · {new Date(e.created_at).toLocaleString()}
                </p>
                {e.reason && <p className="text-xs text-slate-600 mt-1">Reason: {e.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
