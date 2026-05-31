import { useTelegramStatus } from "../api/status";
import { useTelegramLogout } from "../api/telegram";
import { TelegramBadge } from "../components/StatusBadge";
import { TelegramLoginWizard } from "../components/TelegramLoginWizard";

export function SettingsPage() {
  const { data: tg, isLoading } = useTelegramStatus();
  const logout = useTelegramLogout();

  // Show the connect wizard whenever there's no usable session.
  const needsLogin =
    tg?.state === "no_session" || tg?.state === "session_expired" || tg?.state === "error";

  return (
    <div className="page">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      <div className="card">
        <h2>Telegram connection</h2>
        {isLoading && <p className="muted">Loading…</p>}
        {tg && (
          <div className="kv">
            <div className="kv-row">
              <span className="muted">State</span>
              <TelegramBadge state={tg.state} />
            </div>
            <div className="kv-row">
              <span className="muted">Account</span>
              <span>{tg.username ? `@${tg.username}` : "—"}</span>
            </div>
            {tg.error && (
              <div className="kv-row">
                <span className="muted">Last error</span>
                <span className="form-error">{tg.error}</span>
              </div>
            )}
          </div>
        )}

        {tg?.state === "session_expired" && (
          <p className="muted hint">
            The Telegram session is no longer valid — it was revoked, expired, or the account
            signed out. Connect again below to mint a fresh session.
          </p>
        )}

        {needsLogin && <TelegramLoginWizard />}

        {tg?.state === "connected" && (
          <div className="tg-wizard-actions">
            <button
              className="btn"
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              {logout.isPending ? "Logging out…" : "Log out"}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <h2>About</h2>
        <p className="muted">
          Telegram → Discord forwarder. Routes map a Telegram source channel to a Discord webhook;
          new messages are ingested, filtered, transformed to Discord markdown, and delivered with
          per-webhook rate limiting and retries.
        </p>
      </div>
    </div>
  );
}
