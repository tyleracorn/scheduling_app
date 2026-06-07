import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  getOccupancyDefaultMode,
  getOccupancyDisplayStrength,
  setOccupancyDefaultMode,
  setOccupancyDisplayStrength,
  type OccupancyDefaultMode,
  type OccupancyDisplayStrength,
} from "../lib/preferences";

function roleBadges(user: { isAdmin: boolean; isCoordinator: boolean }) {
  const badges: string[] = [];
  if (user.isAdmin) badges.push("Admin");
  if (user.isCoordinator || user.isAdmin) badges.push("Coordinator");
  if (!user.isAdmin && !user.isCoordinator) badges.push("Member");
  return badges;
}

export function SettingsPage() {
  const { user, refresh } = useAuth();
  const [mode, setMode] = useState<OccupancyDefaultMode>(() => getOccupancyDefaultMode());
  const [displayStrength, setDisplayStrength] = useState<OccupancyDisplayStrength>(() =>
    getOccupancyDisplayStrength(),
  );
  const [saved, setSaved] = useState(false);
  const [displaySaved, setDisplaySaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (user?.displayName) setDisplayName(user.displayName);
  }, [user?.displayName]);

  function selectOccupancy(next: OccupancyDefaultMode) {
    setMode(next);
    setOccupancyDefaultMode(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  function selectDisplayStrength(next: OccupancyDisplayStrength) {
    setDisplayStrength(next);
    setOccupancyDisplayStrength(next);
    setDisplaySaved(true);
    window.setTimeout(() => setDisplaySaved(false), 2000);
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.updateProfile(displayName.trim());
      await refresh();
      setMessage("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password changed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setBusy(false);
    }
  }

  const badges = user ? roleBadges(user) : [];

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold mb-2">Settings</h1>
        <p className="text-sm text-slate-600">
          <Link to="/" className="underline text-slate-800">
            Back to calendar
          </Link>
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-green-700" role="status">
          {message}
        </p>
      )}

      {user && (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-medium text-slate-800 mb-1">Your account</h2>
          <p className="text-xs text-slate-500 mb-4">
            Email and household are managed by an administrator.
          </p>
          <dl className="text-sm space-y-2 mb-4">
            <div>
              <dt className="text-xs text-slate-500">Email</dt>
              <dd className="text-slate-800">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Household</dt>
              <dd className="text-slate-800">{user.householdName ?? "None assigned"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Role</dt>
              <dd className="flex flex-wrap gap-1.5 mt-0.5">
                {badges.map((b) => (
                  <span
                    key={b}
                    className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded"
                  >
                    {b}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
          <form onSubmit={(e) => void saveProfile(e)} className="space-y-3 mb-6">
            <label className="block text-sm">
              Display name
              <input
                type="text"
                required
                maxLength={100}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
              />
            </label>
            <button
              type="submit"
              disabled={busy || displayName.trim() === user.displayName}
              className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white hover:bg-slate-900 disabled:opacity-50"
            >
              Save name
            </button>
          </form>
          <form onSubmit={(e) => void changePassword(e)} className="space-y-3 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-medium text-slate-800">Change password</h3>
            <label className="block text-sm">
              Current password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
              />
            </label>
            <label className="block text-sm">
              New password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded border border-slate-400 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Update password
            </button>
          </form>
        </section>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-slate-800 mb-1">Occupancy default</h2>
        <p className="text-xs text-slate-500 mb-4">
          Saved in this browser. Pre-fills the green/red choice when you pick, assign, or swap weeks.
          You can change it each time, set none, or mark individual days later on the calendar.
        </p>
        <div className="space-y-3">
          {(["green", "red", "none"] as const).map((value) => (
            <label
              key={value}
              className="flex items-start gap-3 cursor-pointer rounded-md border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-slate-400"
            >
              <input
                type="radio"
                name="occ-mode"
                className="mt-0.5"
                checked={mode === value}
                onChange={() => selectOccupancy(value)}
              />
              <span>
                <span className="font-medium text-slate-800">
                  {value === "green" ? "Green (default)" : value === "red" ? "Red (default)" : "Don't assign default"}
                </span>
              </span>
            </label>
          ))}
        </div>
        {saved && <p className="text-sm text-green-700 mt-4">Saved.</p>}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-slate-800 mb-1">Occupancy on calendar</h2>
        <p className="text-xs text-slate-500 mb-4">
          How strongly green/red occupancy shows on day cells. Saved in this browser only. When
          multiple households overlap on a handoff day, each gets a small labeled marker.
        </p>
        <div className="space-y-3">
          {(
            [
              ["subtle", "Subtle", "Thin outline; tiny dots when several households overlap."],
              ["standard", "Standard", "Colored outline + tint; household initial on each marker."],
              ["strong", "Strong", "Bold outline and background; easiest to scan at a glance."],
            ] as const
          ).map(([value, title, desc]) => (
            <label
              key={value}
              className="flex items-start gap-3 cursor-pointer rounded-md border border-slate-200 p-3 hover:bg-slate-50 has-[:checked]:border-slate-400"
            >
              <input
                type="radio"
                name="occ-display"
                className="mt-0.5"
                checked={displayStrength === value}
                onChange={() => selectDisplayStrength(value)}
              />
              <span>
                <span className="font-medium text-slate-800">{title}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{desc}</span>
              </span>
            </label>
          ))}
        </div>
        {displaySaved && <p className="text-sm text-green-700 mt-4">Saved.</p>}
      </section>
    </div>
  );
}
