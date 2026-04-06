import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout({ children }: { children: React.ReactNode }): React.ReactElement {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="font-semibold text-brand-700 text-lg">
            College Bus Tracker
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            {user?.role === "student" && (
              <Link className="text-slate-600 hover:text-brand-600" to="/student">
                My bus
              </Link>
            )}
            {user?.role === "driver" && (
              <Link className="text-slate-600 hover:text-brand-600" to="/driver">
                Driver
              </Link>
            )}
            {user?.role === "admin" && (
              <Link className="text-slate-600 hover:text-brand-600" to="/admin">
                Admin
              </Link>
            )}
            {user ? (
              <>
                <span className="text-slate-500 hidden sm:inline">{user.name}</span>
                <button
                  type="button"
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-slate-700 hover:bg-slate-200"
                  onClick={async () => {
                    await logout();
                    nav("/login");
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link className="text-brand-600" to="/login">
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
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
