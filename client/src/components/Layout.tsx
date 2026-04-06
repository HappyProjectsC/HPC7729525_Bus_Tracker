import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { NotificationBell } from "./NotificationBell";

export function Layout({ children }: { children: React.ReactNode }): React.ReactElement {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navLinkClass =
    "text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 py-2 md:py-0 border-b border-slate-100 dark:border-slate-700 md:border-0";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="font-semibold text-brand-700 dark:text-brand-400 text-lg shrink-0">
            College Bus Tracker
          </Link>
          <button
            type="button"
            className="md:hidden rounded-lg border border-slate-300 dark:border-slate-600 p-2 text-slate-700 dark:text-slate-200"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          <nav className="hidden md:flex items-center gap-2 sm:gap-3 text-sm flex-wrap justify-end">
            {user?.role === "student" && (
              <Link className={navLinkClass} to="/student">
                My bus
              </Link>
            )}
            {user?.role === "parent" && (
              <Link className={navLinkClass} to="/parent">
                My child&apos;s bus
              </Link>
            )}
            {user?.role === "driver" && (
              <Link className={navLinkClass} to="/driver">
                Driver
              </Link>
            )}
            {user?.role === "admin" && (
              <Link className={navLinkClass} to="/admin">
                Admin
              </Link>
            )}
            <button
              type="button"
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              onClick={toggle}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            {user && (
              <>
                <Link className={navLinkClass} to="/profile">
                  Profile
                </Link>
                <NotificationBell />
                <span className="text-slate-500 dark:text-slate-400 hidden sm:inline max-w-[120px] truncate">
                  {user.name}
                </span>
                <button
                  type="button"
                  className="rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                  onClick={async () => {
                    await logout();
                    nav("/login");
                  }}
                >
                  Log out
                </button>
              </>
            )}
            {!user && (
              <>
                <Link className="text-brand-600 dark:text-brand-400" to="/login">
                  Log in
                </Link>
                <Link
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700"
                  to="/register"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 pb-4">
            <nav className="flex flex-col text-sm pt-2">
              {user?.role === "student" && (
                <Link className={navLinkClass} to="/student">
                  My bus
                </Link>
              )}
              {user?.role === "parent" && (
                <Link className={navLinkClass} to="/parent">
                  My child&apos;s bus
                </Link>
              )}
              {user?.role === "driver" && (
                <Link className={navLinkClass} to="/driver">
                  Driver
                </Link>
              )}
              {user?.role === "admin" && (
                <Link className={navLinkClass} to="/admin">
                  Admin
                </Link>
              )}
              <button
                type="button"
                className="text-left rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-2 mt-1 text-slate-700 dark:text-slate-200"
                onClick={toggle}
              >
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              {user && (
                <>
                  <Link className={navLinkClass} to="/profile">
                    Profile
                  </Link>
                  <div className="flex items-center gap-2 py-2">
                    <NotificationBell />
                    <span className="text-slate-500 dark:text-slate-400 truncate">{user.name}</span>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-2 text-left text-slate-700 dark:text-slate-200"
                    onClick={async () => {
                      await logout();
                      nav("/login");
                    }}
                  >
                    Log out
                  </button>
                </>
              )}
              {!user && (
                <>
                  <Link className={`${navLinkClass} text-brand-600 dark:text-brand-400`} to="/login">
                    Log in
                  </Link>
                  <Link
                    className="mt-2 rounded-lg bg-brand-600 px-3 py-2 text-center text-white hover:bg-brand-700"
                    to="/register"
                  >
                    Register
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
