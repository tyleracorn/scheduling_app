import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type InvitePreview = {
  email: string;
  household_name: string;
  expires_at: string;
};

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    void api
      .getInvitePreview(token)
      .then((res) => setPreview(res.invite))
      .catch((err) =>
        setPreviewError(err instanceof Error ? err.message : "Invalid invite link"),
      );
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.acceptInvite(token, password, displayName);
      await refresh();
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md">
        <p className="text-red-600">Missing invite token in URL.</p>
        <p className="mt-4 text-sm text-slate-600">
          Ask your cabin admin for an invite link, or{" "}
          <Link to="/login" className="underline">
            sign in
          </Link>{" "}
          if you already have an account.
        </p>
      </div>
    );
  }

  if (previewError) {
    return (
      <div className="mx-auto max-w-md">
        <p className="text-red-600">{previewError}</p>
        <p className="mt-4 text-sm text-slate-600">
          Links expire after 7 days. Ask your admin to send a new invite.
        </p>
      </div>
    );
  }

  if (!preview) {
    return <p className="text-slate-500 mx-auto max-w-md">Loading invite…</p>;
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold mb-2">Create your account</h1>
      <p className="text-sm text-slate-600 mb-6">
        Joining <span className="font-medium text-slate-800">{preview.household_name}</span> as{" "}
        <span className="font-medium text-slate-800">{preview.email}</span>
      </p>
      <form onSubmit={onSubmit} className="space-y-4 bg-white p-6 rounded-lg border border-slate-200">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <label className="block text-sm">
          <span className="text-slate-600">Your name</span>
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Password (min 8 characters)</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-slate-800 text-white py-2 font-medium disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Already have an account?{" "}
        <Link to="/login" className="underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
