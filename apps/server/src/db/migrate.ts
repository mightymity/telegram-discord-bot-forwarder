import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { sqlitePathFromUrl } from "./ensure-sqlite";

// Applies Prisma migration SQL to the SQLite database WITHOUT the Prisma CLI,
// so the packaged desktop app (which ships no CLI / query engine — Prisma 7 uses
// a driver adapter) can bring a fresh user database up to schema on first launch.
//
// We reuse Prisma's own `_prisma_migrations` ledger and the same per-folder
// migration.sql files, so this is interchangeable with `prisma migrate deploy`:
// a database already migrated by the CLI in dev is recognised and skipped.

const MIGRATIONS_TABLE = "_prisma_migrations";

function migrationsDir(): string {
  // The desktop main process points this at the unpacked migrations folder.
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  // Dev (tsx): src/db -> ../../prisma/migrations.
  return path.resolve(__dirname, "..", "..", "prisma", "migrations");
}

interface PendingMigration {
  name: string;
  sql: string;
  checksum: string;
}

function readMigrations(dir: string): PendingMigration[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort() // lexicographic = chronological (Prisma's timestamp prefix)
    .map((name) => {
      const sqlPath = path.join(dir, name, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      return { name, sql, checksum };
    });
}

function ensureLedger(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
      "id"                    TEXT PRIMARY KEY NOT NULL,
      "checksum"              TEXT NOT NULL,
      "finished_at"           DATETIME,
      "migration_name"        TEXT NOT NULL,
      "logs"                  TEXT,
      "rolled_back_at"        DATETIME,
      "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
      "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
    );
  `);
}

function appliedNames(db: Database.Database): Set<string> {
  const rows = db
    .prepare(`SELECT migration_name FROM "${MIGRATIONS_TABLE}" WHERE finished_at IS NOT NULL`)
    .all() as { migration_name: string }[];
  return new Set(rows.map((r) => r.migration_name));
}

// Bring the database at DATABASE_URL up to the latest migration. Idempotent:
// already-applied migrations (by either this runner or the Prisma CLI) are
// skipped. Safe to call on every boot.
export function applyMigrations(databaseUrl = process.env.DATABASE_URL): void {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const dbPath = sqlitePathFromUrl(databaseUrl);
  if (!dbPath) return; // :memory: or non-file URL — nothing to migrate on disk

  const migrations = readMigrations(migrationsDir());
  if (migrations.length === 0) return;

  const db = new Database(dbPath);
  try {
    db.pragma("foreign_keys = ON");
    ensureLedger(db);
    const done = appliedNames(db);

    for (const m of migrations) {
      if (done.has(m.name)) continue;
      const insert = db.prepare(
        `INSERT INTO "${MIGRATIONS_TABLE}" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
         VALUES (?, ?, ?, current_timestamp, current_timestamp, 1)`,
      );
      const runOne = db.transaction(() => {
        db.exec(m.sql);
        insert.run(crypto.randomUUID(), m.checksum, m.name);
      });
      runOne();
    }
  } finally {
    db.close();
  }
}

if (require.main === module) {
  applyMigrations();
}
