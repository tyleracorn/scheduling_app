import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await api.resetPassword(token, password);
    setDone(true);
    setTimeout(() => navigate("/login"), 2000);
  }

  if (!token) return <p className="text-red-600">Missing reset token.</p>;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold mb-6">Reset password</h1>
      {done ? (
        <p className="text-green-700">Password updated. Redirecting to sign in…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 bg-white p-6 rounded-lg border border-slate-200">
          <label className="block text-sm">
            <span className="text-slate-600">New password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <button type="submit" className="w-full rounded bg-slate-800 text-white py-2">
            Update password
          </button>
        </form>
      )}
      <p className="mt-4 text-sm">
        <Link to="/login" className="underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
