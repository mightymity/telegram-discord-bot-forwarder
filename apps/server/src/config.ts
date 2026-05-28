import "./lib/load-env";
import { z } from "zod";

// Treat empty-string env vars (common in .env templates) as "not set".
const emptyToUndefined = (v: unknown) => (v === "" || v === undefined ? undefined : v);

const optionalStr = z.preprocess(emptyToUndefined, z.string().optional());
const optionalInt = z.preprocess(emptyToUndefined, z.coerce.number().int().optional());

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().min(1, "ADMIN_PASSWORD is required"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 chars"),

  TELEGRAM_API_ID: optionalInt,
  TELEGRAM_API_HASH: optionalStr,
  TELEGRAM_SESSION: optionalStr,

  FORWARD_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  DISCORD_RATE_PER_MIN: z.coerce.number().int().positive().default(25),
  DISCORD_MAX_UPLOAD_MB: z.coerce.number().positive().default(8),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const env = parsed.data;

export const config = {
  ...env,
  isProd: env.NODE_ENV === "production",
  // Telegram is usable only when all three credentials are present.
  telegramConfigured: Boolean(
    env.TELEGRAM_API_ID && env.TELEGRAM_API_HASH && env.TELEGRAM_SESSION,
  ),
};

export type AppConfig = typeof config;
