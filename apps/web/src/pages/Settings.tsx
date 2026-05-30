import { useTelegramStatus } from "../api/status";
import { TelegramBadge } from "../components/StatusBadge";

export function SettingsPage() {
  const { data: tg, isLoading } = useTelegramStatus();

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
        {tg?.state === "no_session" && (
          <p className="muted hint">
            No Telegram session configured. Run <code>npm run telegram:login</code> and set{" "}
            <code>TELEGRAM_SESSION</code> (plus API id/hash) in the server environment, then restart.
          </p>
        )}
        {tg?.state === "session_expired" && (
          <p className="muted hint">
            The Telegram session is no longer valid — it was revoked, expired, or the account
            signed out. Reconnecting can't fix this: run <code>npm run telegram:login</code> again
            to mint a fresh <code>TELEGRAM_SESSION</code>, update the server environment, then
            restart.
          </p>
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
