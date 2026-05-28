export class DiscordSendError extends Error {
  status: number;
  retryAfterMs?: number;

  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message);
    this.name = "DiscordSendError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface WebhookFile {
  name: string;
  data: Uint8Array;
  contentType?: string;
}

export interface WebhookSendOptions {
  webhookUrl: string;
  content?: string;
  username?: string | null;
  avatarUrl?: string | null;
  file?: WebhookFile | null;
  // When true, request the created message back (200 instead of 204).
  wait?: boolean;
}

// Sends one message to a Discord webhook. Throws DiscordSendError on non-2xx,
// carrying retryAfterMs when Discord rate-limits us (HTTP 429).
export async function sendToWebhook(opts: WebhookSendOptions): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (opts.content) payload.content = opts.content;
  if (opts.username) payload.username = opts.username;
  if (opts.avatarUrl) payload.avatar_url = opts.avatarUrl;
  // Avoid accidental @everyone / role pings from forwarded content.
  payload.allowed_mentions = { parse: [] };

  const url = opts.wait ? `${opts.webhookUrl}?wait=true` : opts.webhookUrl;

  let res: Response;
  if (opts.file) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify(payload));
    // Copy into a fresh ArrayBuffer-backed view so it satisfies BlobPart typing.
    const bytes = new Uint8Array(opts.file.data);
    const blob = new Blob([bytes], {
      type: opts.file.contentType ?? "application/octet-stream",
    });
    form.append("files[0]", blob, opts.file.name);
    res = await fetch(url, { method: "POST", body: form });
  } else {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  if (res.ok) return;

  if (res.status === 429) {
    let retryAfterMs = 1000;
    try {
      const body = (await res.json()) as { retry_after?: number };
      if (typeof body.retry_after === "number") retryAfterMs = Math.ceil(body.retry_after * 1000);
    } catch {
      const header = res.headers.get("retry-after");
      if (header) retryAfterMs = Math.ceil(Number(header) * 1000);
    }
    throw new DiscordSendError("Discord rate limited", 429, retryAfterMs);
  }

  const text = await res.text().catch(() => "");
  throw new DiscordSendError(
    `Discord webhook returned ${res.status}: ${text.slice(0, 300)}`,
    res.status,
  );
}
