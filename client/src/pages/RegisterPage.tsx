import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function RegisterPage(): React.ReactElement {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await register(name, email, password);
      nav("/", { replace: true });
    } catch {
      setErr("Could not register. Email may already be in use.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold text-slate-800 mb-2">Student registration</h1>
      <p className="text-slate-600 text-sm mb-6">Creates a student account. Admins add drivers separately.</p>
      <form onSubmit={onSubmit} className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
          <input
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password (min 8)</label>
          <input
            type="password"
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 text-white py-2.5 font-medium hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
        <p className="text-sm text-slate-600 text-center">
          Already have an account?{" "}
          <Link className="text-brand-600" to="/login">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
