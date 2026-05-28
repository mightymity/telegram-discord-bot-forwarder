import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureSqliteDatabaseFile } from "../src/db/ensure-sqlite";

let tmpDir: string | null = null;

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

function makeTmpDir(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "forwarder-sqlite-"));
  return tmpDir;
}

describe("ensureSqliteDatabaseFile", () => {
  it("creates the SQLite file and parent directory for file URLs", () => {
    const dir = makeTmpDir();
    const dbPath = path.join(dir, "nested", "app.db");
    const dbUrl = `file:${dbPath.replace(/\\/g, "/")}`;

    ensureSqliteDatabaseFile(dbUrl);

    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("ignores non-SQLite database URLs", () => {
    expect(() => ensureSqliteDatabaseFile("postgresql://localhost/app")).not.toThrow();
  });
});
