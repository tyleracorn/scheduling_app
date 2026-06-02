import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AdminSettings } from "../lib/api";

type Household = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  is_worker_bee: boolean;
};

export function AdminPage() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [slotCount, setSlotCount] = useState(5);
  const [email, setEmail] = useState("");
  const [householdId, setHouseholdId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [hh, st] = await Promise.all([api.adminHouseholds(), api.adminSettings()]);
      setHouseholds(hh.households);
      setSettings(st.settings);
      setSlotCount(st.settings.household_slot_count);
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
    try {
      const res = await api.inviteUser(email, householdId);
      setMessage(`Invite sent to ${res.invite.email}. Check server logs if SMTP is not configured.`);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
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

  async function patchHousehold(id: string, data: Partial<Household>) {
    setBusy(true);
    setError(null);
    try {
      await api.updateAdminHousehold(id, {
        name: data.name,
        color: data.color,
        active: data.active,
        is_worker_bee: data.is_worker_bee,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  const inviteHouseholds = households.filter((h) => h.active && !h.is_worker_bee);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-2">Administration</h1>
      <p className="text-slate-600 text-sm mb-6">
        Manage owning households, the Worker Bee group slot, and user invites.
      </p>

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

      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-medium text-slate-800 mb-1">Owning households</h2>
        <p className="text-xs text-slate-500 mb-4">
          How many families share the schedule in the draft. Worker Bee is separate — for group
          project weeks assigned by the coordinator.
        </p>
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
      </section>

      <section className="mb-8">
        <h2 className="font-medium text-slate-800 mb-2">Households</h2>
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
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={onInvite} className="space-y-4 bg-white p-6 rounded-lg border border-slate-200">
        <h2 className="font-medium text-slate-800">Invite user</h2>
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
        <button type="submit" className="rounded bg-slate-800 text-white px-4 py-2 text-sm font-medium">
          Send invite
        </button>
      </form>
    </div>
  );
}
