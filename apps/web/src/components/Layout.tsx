import { Link, Outlet, useNavigate } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="font-semibold text-lg text-slate-800">
            Cabin Schedule
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {user && (
              <Link to="/periods" className="text-slate-600 hover:text-slate-900">
                Periods
              </Link>
            )}
            {user && (
              <Link to="/settings" className="text-slate-600 hover:text-slate-900">
                Settings
              </Link>
            )}
            {user?.isAdmin && (
              <Link to="/admin" className="text-slate-600 hover:text-slate-900">
                Admin
              </Link>
            )}
            {user && <NotificationBell />}
            {user && (
              <span className="text-slate-500">
                {user.displayName}
                {user.householdName ? ` · ${user.householdName}` : ""}
              </span>
            )}
            {user && (
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="text-slate-600 hover:text-slate-900"
              >
                Log out
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
