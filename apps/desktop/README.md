# Desktop app (Electron)

Packages the forwarder as an installable desktop app. On launch it starts the
Fastify server in the background (as a forked Node process), waits for
`/api/health`, then opens the dashboard in a window. First launch generates a
random `SESSION_SECRET` and dashboard password (shown in a dialog and saved to
`credentials.txt`), and creates the SQLite database — all under the OS app-data
folder. Telegram is connected from the in-dashboard wizard (Settings page); no
CLI or `.env` editing required.

## Build & package

From the repo root:

```bash
# Build installers for the current platform
npm run desktop:dist:mac     # → apps/desktop/dist-installers/*.dmg   (run on macOS)
npm run desktop:dist:win     # → apps/desktop/dist-installers/*.exe   (run on Windows)
```

`desktop:dist*` runs `prisma generate` → builds the dashboard → bundles the
server (esbuild) → copies `web/` + `migrations/` into `build/` → runs
electron-builder (which rebuilds `better-sqlite3` for Electron's ABI and
collects it into the app).

### Quick unpacked run (no installer)

```bash
npm run desktop:build            # build server + main + assets
npm --workspace @forwarder/desktop run rebuild-native   # better-sqlite3 → Electron ABI
npm run desktop:start            # launch Electron against build/
```

## Important notes

- **Windows installers must be built on Windows** (or a Windows CI runner).
  `better-sqlite3` is a native module; its binary is compiled for the build
  host's OS/arch and cannot be cross-built reliably. macOS builds produce the
  `.dmg`; Windows builds produce the NSIS installer + portable `.exe`.

- **`better-sqlite3` ABI is shared with the dev server.** Building/packaging the
  desktop app (or running `rebuild-native`) recompiles `better-sqlite3` for
  Electron's ABI, which breaks the plain `npm run dev` server (system Node).
  To go back to dev, run once at the repo root:

  ```bash
  npm rebuild better-sqlite3
  ```

- **App data location** (config, password, database, logs):
  - macOS: `~/Library/Application Support/TG to Discord Forwarder/`
  - Windows: `%APPDATA%/TG to Discord Forwarder/`

- **Icons**: drop `resources/icon.icns` (mac) and `resources/icon.ico` (win) to
  replace the default Electron icon; otherwise the default is used.

## Why asar is disabled

The server runs as a forked child with `ELECTRON_RUN_AS_NODE=1` so it executes
as plain Node. In that mode Electron's asar filesystem patching is inactive, so
the child cannot read files packed inside an `app.asar`. Disabling asar keeps
`server.cjs`, the bundled assets, and `node_modules` as real files on disk that
the child can read.
