import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useLogout, useMe } from "../api/auth";
import { useTelegramStatus } from "../api/status";
import { useServerEvents } from "../lib/useServerEvents";
import { TelegramBadge } from "./StatusBadge";

const NAV = [
  { to: "/", label: "Overview", end: true },
  { to: "/routes", label: "Routes", end: false },
  { to: "/logs", label: "Logs", end: false },
  { to: "/settings", label: "Settings", end: false },
];

export function Layout() {
  useServerEvents();
  const { data: me } = useMe();
  const { data: tg } = useTelegramStatus();
  const logout = useLogout();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate("/login", { replace: true }) });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Forwarder</div>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="tg-status">
            <span className="muted">Telegram</span>
            {tg ? <TelegramBadge state={tg.state} /> : <span className="badge">…</span>}
          </div>
          <div className="user-row">
            <span className="muted">{me?.username}</span>
            <button className="btn btn-ghost" onClick={handleLogout} disabled={logout.isPending}>
              Log out
            </button>
          </div>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
