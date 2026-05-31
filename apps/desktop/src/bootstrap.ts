import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// First-run secrets live in userData (writable), never in the read-only app
// bundle. The server reads these as env vars (config.ts validates at boot).
export interface AppSecrets {
  sessionSecret: string;
  adminUsername: string;
  adminPassword: string;
  isFirstRun: boolean;
}

// A readable but unpredictable password for the dashboard login. Avoids
// ambiguous characters so the user can retype it from credentials.txt.
function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(16);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function loadOrCreateSecrets(userDataDir: string): AppSecrets {
  const configPath = path.join(userDataDir, "config.json");

  if (fs.existsSync(configPath)) {
    const saved = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<AppSecrets>;
    if (saved.sessionSecret && saved.adminPassword) {
      return {
        sessionSecret: saved.sessionSecret,
        adminUsername: saved.adminUsername ?? "admin",
        adminPassword: saved.adminPassword,
        isFirstRun: false,
      };
    }
  }

  const secrets: AppSecrets = {
    sessionSecret: crypto.randomBytes(32).toString("hex"),
    adminUsername: "admin",
    adminPassword: generatePassword(),
    isFirstRun: true,
  };

  fs.mkdirSync(userDataDir, { recursive: true });
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        sessionSecret: secrets.sessionSecret,
        adminUsername: secrets.adminUsername,
        adminPassword: secrets.adminPassword,
      },
      null,
      2,
    ),
  );
  // Human-readable copy so the user can find their login after first launch.
  fs.writeFileSync(
    path.join(userDataDir, "credentials.txt"),
    `Telegram → Discord Forwarder — dashboard login\n\n` +
      `Username: ${secrets.adminUsername}\n` +
      `Password: ${secrets.adminPassword}\n\n` +
      `Keep this file safe. You can change nothing here — it only records the\n` +
      `auto-generated password created on first launch.\n`,
  );

  return secrets;
}

export interface ServerPaths {
  /** Bundled server entry (build/server.cjs). */
  serverEntry: string;
  /** Built dashboard directory. */
  webDist: string;
  /** Prisma migration SQL directory. */
  migrationsDir: string;
}

// The build step makes `build/` self-contained (server.cjs + web/ + migrations/),
// so the same layout works in dev and packaged — no resourcesPath branching.
// `buildDir` is the directory containing the compiled main.js (i.e. __dirname).
export function resolveServerPaths(buildDir: string): ServerPaths {
  return {
    serverEntry: path.join(buildDir, "server.cjs"),
    webDist: path.join(buildDir, "web"),
    migrationsDir: path.join(buildDir, "migrations"),
  };
}

export function buildServerEnv(opts: {
  userDataDir: string;
  port: number;
  secrets: AppSecrets;
  paths: ServerPaths;
}): NodeJS.ProcessEnv {
  const dbPath = path.join(opts.userDataDir, "data", "forwarder.db");
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    PORT: String(opts.port),
    PUBLIC_URL: `http://localhost:${opts.port}`,
    DATABASE_URL: `file:${dbPath}`,
    SESSION_SECRET: opts.secrets.sessionSecret,
    ADMIN_USERNAME: opts.secrets.adminUsername,
    ADMIN_PASSWORD: opts.secrets.adminPassword,
    WEB_DIST_PATH: opts.paths.webDist,
    MIGRATIONS_DIR: opts.paths.migrationsDir,
  };
}
