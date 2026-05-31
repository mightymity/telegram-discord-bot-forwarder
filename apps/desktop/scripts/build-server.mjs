import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const buildDir = path.join(here, "..", "build");

// Bundle the Fastify server into a single CommonJS file the Electron main
// process can fork. Native and generated-code packages can't be bundled, so we
// keep them external and ship them in node_modules (see electron-builder.yml).
await build({
  entryPoints: [path.join(repoRoot, "apps/server/src/index.ts")],
  outfile: path.join(buildDir, "server.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: true,
  // Resolve the workspace source alias the same way tsconfig paths do.
  alias: {
    "@forwarder/shared": path.join(repoRoot, "packages/shared/src/index.ts"),
  },
  // better-sqlite3 is a native module and cannot be bundled; everything else
  // (Fastify, GramJS, Prisma client + adapter) is plain JS that esbuild inlines.
  external: ["better-sqlite3"],
  logLevel: "info",
});

// Make build/ self-contained: copy the built dashboard and migration SQL in
// alongside server.cjs so the packaged app needs no monorepo-relative lookups.
const webSrc = path.join(repoRoot, "apps/web/dist");
const webDst = path.join(buildDir, "web");
if (!fs.existsSync(webSrc)) {
  throw new Error(`Dashboard not built — run the web build first (missing ${webSrc})`);
}
fs.rmSync(webDst, { recursive: true, force: true });
fs.cpSync(webSrc, webDst, { recursive: true });

const migSrc = path.join(repoRoot, "apps/server/prisma/migrations");
const migDst = path.join(buildDir, "migrations");
fs.rmSync(migDst, { recursive: true, force: true });
fs.cpSync(migSrc, migDst, { recursive: true });

console.log("built build/server.cjs (+ web/, migrations/)");
