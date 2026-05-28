import { useState, type FormEvent } from "react";
import type { RouteDTO, RouteInput } from "@forwarder/shared";
import { ApiError } from "../lib/api";
import {
  useCreateRoute,
  useDeleteRoute,
  useRoutes,
  useTestRoute,
  useUpdateRoute,
} from "../api/routes";
import { useDialogs } from "../api/status";

type Editing = RouteDTO | "new" | null;

const EMPTY: RouteInput = {
  name: "",
  tgSourceId: "",
  tgSourceTitle: "",
  discordWebhook: "",
  discordName: "",
  discordAvatar: "",
  enabled: true,
  forwardText: true,
  forwardPhotos: true,
  includeKeywords: "",
  excludeKeywords: "",
};

function toInput(r: RouteDTO): RouteInput {
  return {
    name: r.name,
    tgSourceId: r.tgSourceId,
    tgSourceTitle: r.tgSourceTitle ?? "",
    discordWebhook: r.discordWebhook,
    discordName: r.discordName ?? "",
    discordAvatar: r.discordAvatar ?? "",
    enabled: r.enabled,
    forwardText: r.forwardText,
    forwardPhotos: r.forwardPhotos,
    includeKeywords: r.includeKeywords ?? "",
    excludeKeywords: r.excludeKeywords ?? "",
  };
}

export function RoutesPage() {
  const { data: routes, isLoading } = useRoutes();
  const [editing, setEditing] = useState<Editing>(null);
  const del = useDeleteRoute();
  const test = useTestRoute();
  const toggle = useUpdateRoute();
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const runTest = (id: string) => {
    test.mutate(id, {
      onSuccess: () => setTestResult((s) => ({ ...s, [id]: "✅ Sent" })),
      onError: (e) =>
        setTestResult((s) => ({ ...s, [id]: e instanceof ApiError ? `❌ ${e.message}` : "❌ Failed" })),
    });
  };

  return (
    <div className="page">
      <header className="page-head row-between">
        <h1>Routes</h1>
        <button className="btn btn-primary" onClick={() => setEditing("new")} disabled={editing === "new"}>
          + New route
        </button>
      </header>

      {editing && (
        <RouteEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {isLoading && <p className="muted">Loading routes…</p>}
      {routes && routes.length === 0 && !editing && (
        <div className="card empty">No routes yet. Create one to start forwarding.</div>
      )}

      <div className="route-list">
        {routes?.map((r) => (
          <div key={r.id} className="card route-item">
            <div className="route-main">
              <div className="route-title">
                {r.name}
                {!r.enabled && <span className="badge badge-skipped">disabled</span>}
              </div>
              <div className="muted route-meta">
                {r.tgSourceTitle ? `${r.tgSourceTitle} · ` : ""}
                {r.tgSourceId} → Discord
                {r.discordName ? ` (as ${r.discordName})` : ""}
              </div>
              <div className="chips">
                {r.forwardText && <span className="chip">text</span>}
                {r.forwardPhotos && <span className="chip">photos</span>}
                {r.includeKeywords && <span className="chip">include: {r.includeKeywords}</span>}
                {r.excludeKeywords && <span className="chip">exclude: {r.excludeKeywords}</span>}
              </div>
              {testResult[r.id] && <div className="muted test-result">{testResult[r.id]}</div>}
            </div>
            <div className="route-actions">
              <button
                className={r.enabled ? "btn" : "btn btn-primary"}
                onClick={() => toggle.mutate({ id: r.id, input: { enabled: !r.enabled } })}
                disabled={toggle.isPending}
                title={r.enabled ? "Stop forwarding from this route" : "Resume forwarding from this route"}
              >
                {r.enabled ? "Disable" : "Enable"}
              </button>
              <button className="btn" onClick={() => runTest(r.id)} disabled={test.isPending}>
                Test
              </button>
              <button className="btn" onClick={() => setEditing(r)}>Edit</button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (confirm(`Delete route "${r.name}"? Its logs will be removed too.`)) del.mutate(r.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RouteEditor({ initial, onClose }: { initial: RouteDTO | null; onClose: () => void }) {
  const [form, setForm] = useState<RouteInput>(initial ? toInput(initial) : EMPTY);
  const [showPicker, setShowPicker] = useState(false);
  const create = useCreateRoute();
  const update = useUpdateRoute();
  const dialogs = useDialogs(showPicker);

  const set = <K extends keyof RouteInput>(key: K, value: RouteInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const pending = create.isPending || update.isPending;
  const error = (create.error ?? update.error) as unknown;
  const errorMessage = error instanceof ApiError ? error.message : error ? "Save failed" : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const onSuccess = () => onClose();
    if (initial) update.mutate({ id: initial.id, input: form }, { onSuccess });
    else create.mutate(form, { onSuccess });
  };

  return (
    <form className="card route-editor" onSubmit={submit}>
      <h2>{initial ? "Edit route" : "New route"}</h2>

      <div className="form-grid">
        <label className="field">
          <span>Name *</span>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </label>

        <label className="field">
          <span>Telegram source ID *</span>
          <div className="input-row">
            <input
              value={form.tgSourceId}
              onChange={(e) => set("tgSourceId", e.target.value)}
              placeholder="-1001234567890 or @channel"
              required
            />
            <button type="button" className="btn" onClick={() => setShowPicker((v) => !v)}>
              {showPicker ? "Hide" : "Browse"}
            </button>
          </div>
        </label>
      </div>

      {showPicker && (
        <div className="picker">
          {dialogs.isLoading && <span className="muted">Loading channels…</span>}
          {dialogs.isError && (
            <span className="form-error">
              {dialogs.error instanceof ApiError ? dialogs.error.message : "Could not load channels"}
            </span>
          )}
          {dialogs.data && (
            <select
              className="picker-select"
              onChange={(e) => {
                const d = dialogs.data.find((x) => x.id === e.target.value);
                if (d) {
                  set("tgSourceId", d.id);
                  set("tgSourceTitle", d.title);
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>Select a channel…</option>
              {dialogs.data.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.type})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <label className="field">
        <span>Discord webhook URL *</span>
        <input
          value={form.discordWebhook}
          onChange={(e) => set("discordWebhook", e.target.value)}
          placeholder="https://discord.com/api/webhooks/…"
          required
        />
      </label>

      <div className="form-grid">
        <label className="field">
          <span>Override name</span>
          <input value={form.discordName ?? ""} onChange={(e) => set("discordName", e.target.value)} />
        </label>
        <label className="field">
          <span>Override avatar URL</span>
          <input value={form.discordAvatar ?? ""} onChange={(e) => set("discordAvatar", e.target.value)} />
        </label>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Include keywords (comma-sep)</span>
          <input
            value={form.includeKeywords ?? ""}
            onChange={(e) => set("includeKeywords", e.target.value)}
            placeholder="optional"
          />
        </label>
        <label className="field">
          <span>Exclude keywords (comma-sep)</span>
          <input
            value={form.excludeKeywords ?? ""}
            onChange={(e) => set("excludeKeywords", e.target.value)}
            placeholder="optional"
          />
        </label>
      </div>

      <div className="toggles">
        <label className="toggle">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set("enabled", e.target.checked)} />
          Enabled
        </label>
        <label className="toggle">
          <input type="checkbox" checked={form.forwardText} onChange={(e) => set("forwardText", e.target.checked)} />
          Forward text
        </label>
        <label className="toggle">
          <input type="checkbox" checked={form.forwardPhotos} onChange={(e) => set("forwardPhotos", e.target.checked)} />
          Forward photos
        </label>
      </div>

      {errorMessage && <div className="form-error">{errorMessage}</div>}

      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save changes" : "Create route"}
        </button>
      </div>
    </form>
  );
}
