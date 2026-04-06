import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function HomePage(): React.ReactElement {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="text-slate-600">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-brand-600 to-brand-900 text-white rounded-2xl p-8 shadow-lg">
        <h1 className="text-3xl font-bold tracking-tight">College Bus Tracking System</h1>
        <p className="mt-3 text-brand-50 max-w-xl">
          Real-time bus positions from drivers&apos; phones. Students see their assigned bus on the map;
          administrators manage routes, stops, and assignments.
        </p>
        {!user && (
          <div className="mt-6 flex gap-3">
            <Link
              className="rounded-lg bg-white text-brand-700 px-4 py-2 font-medium hover:bg-brand-50"
              to="/register"
            >
              Register as student
            </Link>
            <Link
              className="rounded-lg border border-white/40 px-4 py-2 font-medium hover:bg-white/10"
              to="/login"
            >
              Log in
            </Link>
          </div>
        )}
      </div>

      {user && (
        <div className="grid sm:grid-cols-2 gap-4">
          {user.role === "student" && (
            <Link
              to="/student"
              className="block rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand-300 hover:shadow"
            >
              <h2 className="font-semibold text-slate-800">Student dashboard</h2>
              <p className="text-sm text-slate-600 mt-2">Live map and ETAs for your bus.</p>
            </Link>
          )}
          {user.role === "driver" && (
            <Link
              to="/driver"
              className="block rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand-300 hover:shadow"
            >
              <h2 className="font-semibold text-slate-800">Driver</h2>
              <p className="text-sm text-slate-600 mt-2">Start or stop GPS tracking for your bus.</p>
            </Link>
          )}
          {user.role === "admin" && (
            <Link
              to="/admin"
              className="block rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-brand-300 hover:shadow"
            >
              <h2 className="font-semibold text-slate-800">Admin</h2>
              <p className="text-sm text-slate-600 mt-2">Manage buses, routes, stops, and users.</p>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
