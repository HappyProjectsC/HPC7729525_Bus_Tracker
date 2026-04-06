import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Skeleton } from "../components/Skeleton";

function IconStudent(): React.ReactElement {
  return (
    <svg className="h-8 w-8 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  );
}

function IconDriver(): React.ReactElement {
  return (
    <svg className="h-8 w-8 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m16.5 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125V14.25m-16.5 0V6.75c0-.621.504-1.125 1.125-1.125h12.75c.621 0 1.125.504 1.125 1.125v7.5m-14.25 0h14.25"
      />
    </svg>
  );
}

function IconAdmin(): React.ReactElement {
  return (
    <svg className="h-8 w-8 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function IconParent(): React.ReactElement {
  return (
    <svg className="h-8 w-8 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

export function HomePage(): React.ReactElement {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 text-slate-900 dark:text-slate-100">
      <div className="bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 dark:from-brand-700 dark:via-slate-900 dark:to-slate-950 text-white rounded-2xl p-8 shadow-lg border border-white/10 dark:border-slate-700/50">
        <h1 className="text-3xl font-bold tracking-tight">College Bus Tracking System</h1>
        <p className="mt-3 text-brand-50 dark:text-slate-300 max-w-xl">
          Real-time bus positions from drivers&apos; phones. Students see their assigned bus on the map;
          administrators manage routes, stops, and assignments.
        </p>
        {!user && (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              className="rounded-lg bg-white text-brand-700 px-4 py-2 font-medium hover:bg-brand-50 shadow-sm"
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-4 text-sm text-slate-600 dark:text-slate-300">
        <div className="text-center sm:text-left">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Live GPS</p>
          <p className="text-xs mt-1">Drivers share location in near real time</p>
        </div>
        <div className="text-center sm:text-left border-y sm:border-y-0 sm:border-x border-slate-200 dark:border-slate-600 py-3 sm:py-0 sm:px-4">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Routes &amp; ETAs</p>
          <p className="text-xs mt-1">Planned paths and estimated arrivals</p>
        </div>
        <div className="text-center sm:text-left">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Alerts</p>
          <p className="text-xs mt-1">Push and in-app notifications</p>
        </div>
      </div>

      {user && (
        <div className="grid sm:grid-cols-2 gap-4">
          {user.role === "student" && (
            <Link
              to="/student"
              className="flex gap-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-6 shadow-sm hover:border-brand-300 dark:hover:border-brand-500 hover:shadow-md transition-shadow"
            >
              <IconStudent />
              <div>
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">Student dashboard</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Live map and ETAs for your bus.</p>
              </div>
            </Link>
          )}
          {user.role === "driver" && (
            <Link
              to="/driver"
              className="flex gap-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-6 shadow-sm hover:border-brand-300 dark:hover:border-brand-500 hover:shadow-md transition-shadow"
            >
              <IconDriver />
              <div>
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">Driver</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Start or stop GPS tracking for your bus.</p>
              </div>
            </Link>
          )}
          {user.role === "admin" && (
            <Link
              to="/admin"
              className="flex gap-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-6 shadow-sm hover:border-brand-300 dark:hover:border-brand-500 hover:shadow-md transition-shadow"
            >
              <IconAdmin />
              <div>
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">Admin</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">Manage buses, routes, stops, and users.</p>
              </div>
            </Link>
          )}
          {user.role === "parent" && (
            <Link
              to="/parent"
              className="flex gap-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-6 shadow-sm hover:border-brand-300 dark:hover:border-brand-500 hover:shadow-md transition-shadow"
            >
              <IconParent />
              <div>
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">Parent</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  Track your child&apos;s bus and receive alerts.
                </p>
              </div>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
