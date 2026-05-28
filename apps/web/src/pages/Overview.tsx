import { Link } from "react-router-dom";
import { useStatus } from "../api/status";
import { TelegramBadge } from "../components/StatusBadge";

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function OverviewPage() {
  const { data, isLoading, isError } = useStatus();

  return (
    <div className="page">
      <header className="page-head">
        <h1>Overview</h1>
      </header>

      {isLoading && <p className="muted">Loading status…</p>}
      {isError && <p className="form-error">Failed to load status.</p>}

      {data && (
        <>
          <div className="card-grid">
            <div className="card stat">
              <span className="stat-label">Routes</span>
              <span className="stat-value">{data.routes.enabled}/{data.routes.total}</span>
              <span className="muted">enabled / total</span>
            </div>
            <div className="card stat">
              <span className="stat-label">Forwarded today</span>
              <span className="stat-value">{data.messages.sentToday}</span>
              <span className="muted">{data.messages.today} ingested</span>
            </div>
            <div className="card stat">
              <span className="stat-label">Failures today</span>
              <span className={`stat-value ${data.messages.failedToday > 0 ? "danger" : ""}`}>
                {data.messages.failedToday}
              </span>
              <span className="muted">{data.messages.pending} pending</span>
            </div>
            <div className="card stat">
              <span className="stat-label">Telegram</span>
              <span className="stat-value">
                <TelegramBadge state={data.telegram.state} />
              </span>
              <span className="muted">
                {data.telegram.username ? `@${data.telegram.username}` : data.telegram.error ?? "—"}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="row-between">
              <div>
                <div className="muted">Last activity</div>
                <div className="strong">{formatTime(data.lastActivityAt)}</div>
              </div>
              <div className="actions">
                <Link className="btn" to="/logs">View logs</Link>
                <Link className="btn btn-primary" to="/routes">Manage routes</Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
