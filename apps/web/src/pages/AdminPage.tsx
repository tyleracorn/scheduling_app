import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

export function AdminPage() {
  const [households, setHouseholds] = useState<{ id: string; name: string; color: string }[]>([]);
  const [email, setEmail] = useState("");
  const [householdId, setHouseholdId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .households()
      .then((r) => {
        setHouseholds(r.households.filter((h) => h.active));
        if (r.households[0]) setHouseholdId(r.households[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

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

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-2">Administration</h1>
      <p className="text-slate-600 text-sm mb-6">Invite users to a household. Manage households in API for now.</p>

      <form onSubmit={onInvite} className="space-y-4 bg-white p-6 rounded-lg border border-slate-200">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}
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
            {households.map((h) => (
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

      <section className="mt-8">
        <h2 className="font-medium text-slate-800 mb-2">Households</h2>
        <ul className="space-y-1 text-sm">
          {households.map((h) => (
            <li key={h.id} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: h.color }} />
              {h.name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
