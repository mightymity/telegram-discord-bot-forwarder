import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import type { NewMessageEvent } from "telegram/events";
import { LogLevel } from "telegram/extensions/Logger";
import { config } from "../config";
import { bus } from "../events";
import type {
  TelegramConnectionState,
  TelegramDialog,
  TelegramStatus,
} from "@forwarder/shared";

let client: TelegramClient | null = null;
let state: TelegramConnectionState = config.telegramConfigured ? "disconnected" : "no_session";
let username: string | null = null;
let lastError: string | null = null;

function setState(next: TelegramConnectionState, error: string | null = null): void {
  state = next;
  lastError = error;
  bus.publish({ type: "telegram.status", status: getTelegramStatus() });
}

export function getTelegramStatus(): TelegramStatus {
  return { state, username, error: lastError };
}

export function getClient(): TelegramClient | null {
  return client;
}

export type NewMessageHandler = (event: NewMessageEvent) => void | Promise<void>;

// Connect using the saved StringSession and register the message listener.
// No-op (state = "no_session") when credentials are not configured, so the
// rest of the app (API + dashboard) still boots.
export async function startTelegram(onMessage: NewMessageHandler): Promise<void> {
  if (!config.telegramConfigured) {
    setState("no_session");
    return;
  }
  if (client) return;

  setState("connecting");
  try {
    const session = new StringSession(config.TELEGRAM_SESSION ?? "");
    const instance = new TelegramClient(
      session,
      config.TELEGRAM_API_ID!,
      config.TELEGRAM_API_HASH!,
      { connectionRetries: 5, autoReconnect: true, retryDelay: 2000 },
    );
    instance.setLogLevel(LogLevel.WARN);

    await instance.connect();
    const me = await instance.getMe();
    username = me && "username" in me ? ((me as { username?: string }).username ?? null) : null;

    instance.addEventHandler((event: NewMessageEvent) => {
      void Promise.resolve(onMessage(event)).catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error("[telegram] message handler error:", err);
      });
    }, new NewMessage({}));

    client = instance;
    setState("connected");
  } catch (err) {
    client = null;
    setState("error", err instanceof Error ? err.message : String(err));
    throw err;
  }
}

export async function stopTelegram(): Promise<void> {
  if (!client) return;
  try {
    await client.disconnect();
  } finally {
    client = null;
    setState("disconnected");
  }
}

// List the account's chats so the dashboard can pick a source.
export async function listDialogs(): Promise<TelegramDialog[]> {
  if (!client) throw new Error("Telegram is not connected");
  const dialogs = await client.getDialogs({ limit: 300 });
  const result: TelegramDialog[] = [];
  for (const d of dialogs) {
    if (d.id == null) continue;
    const type: TelegramDialog["type"] = d.isChannel
      ? "channel"
      : d.isGroup
        ? "group"
        : d.isUser
          ? "user"
          : "unknown";
    const entity = d.entity as { username?: string } | undefined;
    result.push({
      id: d.id.toString(),
      title: d.title ?? entity?.username ?? "Untitled",
      type,
      username: entity?.username ?? null,
    });
  }
  return result;
}
