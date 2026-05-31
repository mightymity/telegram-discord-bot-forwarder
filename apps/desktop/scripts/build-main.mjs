import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "..", "src");
const out = path.join(here, "..", "build");

// Compile the Electron main + preload. `electron` is provided by the runtime.
await build({
  entryPoints: [path.join(src, "main.ts"), path.join(src, "preload.ts")],
  outdir: out,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  sourcemap: true,
  external: ["electron"],
  logLevel: "info",
});

console.log("built build/main.js + build/preload.js");
