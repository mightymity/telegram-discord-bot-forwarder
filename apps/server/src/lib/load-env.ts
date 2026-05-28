import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Workspace npm scripts run with cwd set to the package directory
// (e.g. apps/server), but this project keeps a single .env at the monorepo
// root (matching .env.example and the Docker setup). Walk up from here to find
// that root .env and load it, so env works no matter where a command starts.
function findRootEnv(start: string): string | undefined {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, "package-lock.json"))) {
      return path.join(dir, ".env");
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

const base = typeof __dirname !== "undefined" ? __dirname : process.cwd();
const rootEnv = findRootEnv(base);
// Use the explicit root path when found; otherwise fall back to dotenv's
// default (cwd/.env). A missing file is a no-op, so container env still wins.
dotenv.config(rootEnv ? { path: rootEnv } : {});
