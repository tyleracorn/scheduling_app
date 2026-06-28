import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "../context/AuthContext";

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? "font-medium text-slate-900"
    : "text-slate-600 hover:text-slate-900";
}

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    navigate("/login", { replace: true });
  }

  const userLabel = user
    ? `${user.displayName}${user.householdName ? ` · ${user.householdName}` : ""}`
    : "";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-200 bg-white relative z-30">
        <div className="mx-auto max-w-6xl px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          <Link
            to="/"
            className="font-semibold text-base sm:text-lg text-slate-800 truncate min-w-0"
            onClick={() => setMenuOpen(false)}
          >
            Cabin Schedule
          </Link>

          <nav className="hidden md:flex items-center gap-4 text-sm shrink-0">
            {user && (
              <NavLink to="/notes" className={navLinkClass}>
                Notes
              </NavLink>
            )}
            {user && (user.isCoordinator || user.isAdmin) && (
              <NavLink to="/periods" className={navLinkClass}>
                Periods
              </NavLink>
            )}
            {user && (
              <NavLink to="/settings" className={navLinkClass}>
                Settings
              </NavLink>
            )}
            {user?.isAdmin && (
              <NavLink to="/admin" className={navLinkClass}>
                Admin
              </NavLink>
            )}
            {user && <NotificationBell />}
            {user && <span className="text-slate-500 max-w-[12rem] truncate">{userLabel}</span>}
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

          <div className="flex md:hidden items-center gap-1 shrink-0">
            {user && <NotificationBell />}
            {user && (
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
              >
                {menuOpen ? "Close" : "Menu"}
              </button>
            )}
          </div>
        </div>

        {user && menuOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 bg-black/25 z-40 md:hidden"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <nav
              id="mobile-nav"
              className="md:hidden absolute left-0 right-0 top-full border-b border-slate-200 bg-white shadow-lg z-50 px-4 py-4 space-y-1"
            >
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `block rounded px-3 py-2.5 text-sm ${isActive ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700 hover:bg-slate-50"}`
                }
                onClick={() => setMenuOpen(false)}
              >
                Calendar
              </NavLink>
              <NavLink
                to="/notes"
                className={({ isActive }) =>
                  `block rounded px-3 py-2.5 text-sm ${isActive ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700 hover:bg-slate-50"}`
                }
                onClick={() => setMenuOpen(false)}
              >
                Notes
              </NavLink>
              {(user.isCoordinator || user.isAdmin) && (
                <NavLink
                  to="/periods"
                  className={({ isActive }) =>
                    `block rounded px-3 py-2.5 text-sm ${isActive ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700 hover:bg-slate-50"}`
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  Periods
                </NavLink>
              )}
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `block rounded px-3 py-2.5 text-sm ${isActive ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700 hover:bg-slate-50"}`
                }
                onClick={() => setMenuOpen(false)}
              >
                Settings
              </NavLink>
              {user.isAdmin && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `block rounded px-3 py-2.5 text-sm ${isActive ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700 hover:bg-slate-50"}`
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  Admin
                </NavLink>
              )}
              <p className="px-3 pt-3 pb-1 text-xs text-slate-500 border-t border-slate-100 mt-2">
                {userLabel}
              </p>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="w-full text-left rounded px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Log out
              </button>
            </nav>
          </>
        )}
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-2 sm:px-4 py-3 sm:py-6">
        <Outlet />
      </main>
    </div>
  );
}
