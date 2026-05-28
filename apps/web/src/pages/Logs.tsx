import { useState } from "react";
import type { ForwardStatus } from "@forwarder/shared";
import { useMessages, useRetryMessage } from "../api/messages";
import { useRoutes } from "../api/routes";
import { StatusBadge } from "../components/StatusBadge";

const STATUSES: ForwardStatus[] = ["PENDING", "SENT", "FAILED", "SKIPPED"];
const PAGE_SIZE = 25;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function LogsPage() {
  const [page, setPage] = useState(1);
  const [routeId, setRouteId] = useState<string>("");
  const [status, setStatus] = useState<ForwardStatus | "">("");

  const { data: routes } = useRoutes();
  const { data, isLoading, isFetching } = useMessages({
    page,
    pageSize: PAGE_SIZE,
    routeId: routeId || undefined,
    status: status || undefined,
  });
  const retry = useRetryMessage();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const resetTo = (apply: () => void) => {
    apply();
    setPage(1);
  };

  return (
    <div className="page">
      <header className="page-head row-between">
        <h1>Logs {isFetching && <span className="muted small">· refreshing</span>}</h1>
        <div className="filters">
          <select
            value={routeId}
            onChange={(e) => resetTo(() => setRouteId(e.target.value))}
          >
            <option value="">All routes</option>
            {routes?.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => resetTo(() => setStatus(e.target.value as ForwardStatus | ""))}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </header>

      {isLoading && <p className="muted">Loading logs…</p>}

      {data && (
        <div className="card table-wrap">
          <table className="log-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Route</th>
                <th>Status</th>
                <th>Content</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr><td colSpan={5} className="muted center">No messages match these filters.</td></tr>
              )}
              {data.items.map((m) => (
                <tr key={m.id}>
                  <td className="nowrap muted">{formatTime(m.tgDate)}</td>
                  <td>{m.routeName ?? "—"}</td>
                  <td><StatusBadge status={m.status} /></td>
                  <td className="content-cell">
                    {m.hasPhoto && <span className="chip">photo</span>}
                    <span className="content-text">{m.contentText ?? <em className="muted">no text</em>}</span>
                    {m.error && <div className="form-error small">{m.error}</div>}
                  </td>
                  <td>
                    {(m.status === "FAILED" || m.status === "SKIPPED") && (
                      <button
                        className="btn btn-sm"
                        onClick={() => retry.mutate(m.id)}
                        disabled={retry.isPending}
                      >
                        Retry
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pager">
        <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
          ← Prev
        </button>
        <span className="muted">Page {page} of {totalPages}</span>
        <button
          className="btn"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
