import { prisma } from "../db/prisma";
import { config } from "../config";

// Telegram credentials are stored in the AppSetting table so they can be set
// at runtime from the dashboard login wizard (no env edit / restart needed).
// Env vars remain a fallback so existing .env / Docker setups keep working.
const KEY_API_ID = "telegram.apiId";
const KEY_API_HASH = "telegram.apiHash";
const KEY_SESSION = "telegram.session";

export interface TelegramCreds {
  apiId: number;
  apiHash: string;
  session: string;
}

async function readSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function writeSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

// Returns the full credential triple, or null if any part is missing. Prefers
// values saved via the wizard (AppSetting) and falls back to env per-field.
export async function getTelegramCreds(): Promise<TelegramCreds | null> {
  const [storedApiId, storedApiHash, storedSession] = await Promise.all([
    readSetting(KEY_API_ID),
    readSetting(KEY_API_HASH),
    readSetting(KEY_SESSION),
  ]);

  const apiIdRaw = storedApiId ?? (config.TELEGRAM_API_ID ? String(config.TELEGRAM_API_ID) : null);
  const apiHash = storedApiHash ?? config.TELEGRAM_API_HASH ?? null;
  const session = storedSession ?? config.TELEGRAM_SESSION ?? null;

  const apiId = apiIdRaw ? Number(apiIdRaw) : NaN;
  if (!apiId || Number.isNaN(apiId) || !apiHash || !session) return null;

  return { apiId, apiHash, session };
}

export async function saveTelegramCreds(creds: TelegramCreds): Promise<void> {
  await Promise.all([
    writeSetting(KEY_API_ID, String(creds.apiId)),
    writeSetting(KEY_API_HASH, creds.apiHash),
    writeSetting(KEY_SESSION, creds.session),
  ]);
}

// Drops the saved session (and the env fallback would still apply on next read,
// so also clear when present is intentional: callers use this for "log out").
export async function clearTelegramSession(): Promise<void> {
  await prisma.appSetting.deleteMany({
    where: { key: { in: [KEY_API_ID, KEY_API_HASH, KEY_SESSION] } },
  });
}
