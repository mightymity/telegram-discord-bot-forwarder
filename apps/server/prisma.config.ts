import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma runs with cwd = apps/server, but the project's .env lives at the
// monorepo root. Walk up to find and load it so DATABASE_URL resolves.
(() => {
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, "package-lock.json"))) {
      dotenv.config({ path: path.join(dir, ".env") });
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  dotenv.config();
})();

// Prisma 7: connection URL for Migrate/Introspection lives here (not in schema).
// The runtime PrismaClient uses a driver adapter instead (see src/db/prisma.ts).
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx src/db/seed.ts",
  },
});
