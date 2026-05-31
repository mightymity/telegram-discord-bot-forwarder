import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../lib/load-env";

export function sqlitePathFromUrl(databaseUrl: string): string | null {
  if (!databaseUrl.startsWith("file:")) return null;

  if (databaseUrl.startsWith("file://")) {
    return fileURLToPath(databaseUrl);
  }

  let rawPath = databaseUrl.slice("file:".length);
  const queryStart = rawPath.search(/[?#]/);
  if (queryStart !== -1) rawPath = rawPath.slice(0, queryStart);
  if (!rawPath || rawPath === ":memory:") return null;

  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

export function ensureSqliteDatabaseFile(databaseUrl = process.env.DATABASE_URL): void {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const dbPath = sqlitePathFromUrl(databaseUrl);
  if (!dbPath) return;

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const fd = fs.openSync(dbPath, "a");
  fs.closeSync(fd);
}

if (require.main === module) {
  ensureSqliteDatabaseFile();
}
