import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await api.forgotPassword(email);
    setMessage(res.message);
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold mb-6">Forgot password</h1>
      <form onSubmit={onSubmit} className="space-y-4 bg-white p-6 rounded-lg border border-slate-200">
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
        <button type="submit" className="w-full rounded bg-slate-800 text-white py-2">
          Send reset link
        </button>
        {message && <p className="text-sm text-green-700">{message}</p>}
      </form>
      <p className="mt-4 text-sm">
        <Link to="/login" className="underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
