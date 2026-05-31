import { TelegramClient } from "telegram";

// Holds the connected TelegramClient between the two steps of the interactive
// login wizard (send code -> verify code). Kept in memory only; entries expire
// so a half-finished login doesn't leak a connected client forever.
const TTL_MS = 5 * 60 * 1000;

export interface PendingLogin {
  client: TelegramClient;
  apiId: number;
  apiHash: string;
  phone: string;
  phoneCodeHash: string;
  expiresAt: number;
}

const pending = new Map<string, PendingLogin>();

// Opaque, hard-to-guess state token. crypto.randomUUID is available on Node 20+
// and inside Electron's bundled Node.
function newState(): string {
  return globalThis.crypto.randomUUID();
}

function disconnectQuietly(client: TelegramClient): void {
  void client.disconnect().catch(() => undefined);
}

export function putPendingLogin(
  entry: Omit<PendingLogin, "expiresAt">,
): string {
  const state = newState();
  pending.set(state, { ...entry, expiresAt: Date.now() + TTL_MS });
  return state;
}

export function getPendingLogin(state: string): PendingLogin | null {
  const entry = pending.get(state);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    pending.delete(state);
    disconnectQuietly(entry.client);
    return null;
  }
  return entry;
}

export function dropPendingLogin(state: string, disconnect = true): void {
  const entry = pending.get(state);
  if (!entry) return;
  pending.delete(state);
  if (disconnect) disconnectQuietly(entry.client);
}

// Periodically reap expired logins (the lazy check in getPendingLogin only
// fires when a state is looked up; abandoned logins would otherwise linger).
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [state, entry] of pending) {
    if (entry.expiresAt < now) {
      pending.delete(state);
      disconnectQuietly(entry.client);
    }
  }
}, 60 * 1000);
sweepTimer.unref?.();
