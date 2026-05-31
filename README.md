# Telegram → Discord Forwarder

Auto-forwards messages from a **Telegram channel** to a **Discord channel** via webhook,
with a web **dashboard** to configure routes, watch live activity, and inspect/retry the
message log. Built to scale from one channel to many.

Messages are read from Telegram using a **user account (MTProto / GramJS)** — so you don't
need to be an admin of the source channel — persisted to a local SQLite database, then
delivered to Discord through a rate-limited, retrying send queue.

> ⚠️ **Telegram ToS note.** Automating a *user* account to read messages is against
> Telegram's Terms (they prefer the Bot API). For low-volume personal use this generally
> works, but carries a risk of account limits. Use a dedicated account and keep the rate
> low. The ingestion layer is isolated so you can swap to the Bot API later if you gain
> admin rights on the source channel.

## ⬇️ Download (desktop app)

No setup required — install, open, and use the dashboard. Telegram is connected
from a wizard inside the app (no command line, no `.env`).

### **[➡️ Download the latest release](https://github.com/mightymity/telegram-discord-bot-forwarder/releases/latest)**

On the release page, pick the file for your OS:

| OS | File | Notes |
|----|------|-------|
| **Windows** | `TG to Discord Forwarder Setup ….exe` | Installer (Start-menu shortcut). The portable `…​.exe` runs without installing. |
| **macOS (Apple Silicon)** | `TG to Discord Forwarder-…-arm64.dmg` | Open, drag the app into Applications. |

**First launch:** the app shows an auto-generated dashboard **username + password**
(also saved to `credentials.txt` in the app's data folder). Log in, open
**Settings**, enter your Telegram API id/hash + phone, type the code Telegram
sends you, and you're connected.

> The apps are not code-signed yet, so the OS shows a warning the first time:
> - **Windows:** SmartScreen → *More info* → *Run anyway*.
> - **macOS:** right-click the app → *Open* → *Open* (or System Settings →
>   Privacy & Security → *Open Anyway*).

<details>
<summary>Maintainers: how to publish a downloadable release</summary>

Pushing a version tag builds the Windows installers on CI and attaches them to a
GitHub Release automatically (see `.github/workflows/desktop-windows.yml`):

```bash
git tag v0.1.0 && git push origin v0.1.0
```

macOS `.dmg` is built locally with `npm run desktop:dist:mac` and can be uploaded
to the same release. See [apps/desktop/README.md](apps/desktop/README.md) for the
full build details and caveats (Windows binaries must be built on Windows).
</details>

## Features

- **Auto-forward** text and photos, Telegram formatting → Discord markdown
  (bold, italic, underline, strikethrough, spoiler, code, code blocks, links).
- Messages longer than Discord's 2000-char limit are split on sensible boundaries.
- **Per-route config**: source chat, destination webhook, webhook name/avatar override,
  toggles for text/photos, and optional include/exclude **keyword filters**.
- **Reliable delivery**: persist-before-send, dedupe (no double forwards), automatic
  retry with backoff that respects Discord `429 retry_after` and Telegram FloodWait.
  Pending messages are re-queued on restart.
- **Dashboard** (login-protected): overview stats, route CRUD with a source picker,
  a searchable message log with one-click retry, and connection status — all updating
  **live over SSE**.
- Single-container **Docker** deployment; SQLite + config persist on a volume.

## Architecture

```
Telegram channel
      │  MTProto (GramJS user session) — NewMessage events
      ▼
┌──────────────────────────────────────────────────────────┐
│  Forwarder service (Node.js + TypeScript, Fastify)         │
│   listener → router → persist(dedupe) → send queue         │
│        │                                   │ Discord webhook│
│   SQLite (Prisma)                          ▼  (text + photo)│
│   REST + SSE  ───────────────────────►  Discord channel     │
└──────────────────────────────────────────────────────────┘
      ▲  HTTP / SSE (same origin in prod, Vite proxy in dev)
      │
  Dashboard (React + Vite): Login · Overview · Routes · Logs · Settings
```

In production the server also serves the built dashboard, so everything runs on **one port
in one container**.

## Tech stack

| Area        | Choice                                                            |
| ----------- | ----------------------------------------------------------------- |
| Telegram    | GramJS (`telegram`) + `StringSession`                             |
| Discord     | Webhook via `fetch` (multipart for photos)                        |
| Server      | Fastify 5, `@fastify/{cookie,jwt,cors,rate-limit,static}`, `pino` |
| Queue       | Bottleneck (rate-limit + retry/backoff)                           |
| DB / ORM    | SQLite + Prisma 7 (better-sqlite3 driver adapter)                 |
| Dashboard   | React 19 + Vite 8, TanStack Query, React Router, `EventSource`    |
| Auth        | JWT in an httpOnly cookie, `bcryptjs` password hashing            |
| Config      | `dotenv` + `zod` validation                                       |
| Runtime     | `tsx` (runs TypeScript directly — no build step for the server)   |
| Deploy      | Docker multi-stage + docker-compose                               |

## Prerequisites

- **Node.js ≥ 20** (or Docker)
- A **Telegram account** + `api_id` / `api_hash` from <https://my.telegram.org> →
  *API development tools*
- A **Discord webhook URL** for the target channel
  (Server Settings → Integrations → Webhooks → New Webhook → Copy URL)

## Quick start (local dev)

```bash
# 1. Install dependencies (npm workspaces — run from the repo root)
npm install

# 2. Create your env file and fill it in
cp .env.example .env
#    → set ADMIN_PASSWORD, SESSION_SECRET, TELEGRAM_API_ID, TELEGRAM_API_HASH

# 3. Create the SQLite schema (and the initial admin user)
npm run prisma:migrate
npm run db:seed

# 4. Log in to Telegram once to mint a session string (see below)
npm run telegram:login
#    → paste the printed value into .env as TELEGRAM_SESSION

# 5. Run server + dashboard together (server :3000, Vite dev :5173 with /api proxy)
npm run dev
```

Then open the dashboard, sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`, and create a
route: pick a Telegram source, paste the Discord webhook URL, and enable it.

> The dashboard and API work **without** Telegram credentials — ingestion is simply
> disabled (status shows `no_session`) until you configure them.

## Telegram login

`npm run telegram:login` runs an interactive CLI that prompts for your phone number, the
login code Telegram sends you, and your 2FA password if you have one. It prints a
**`TELEGRAM_SESSION`** string — paste it into `.env`.

This string grants full access to your Telegram account. **Keep it secret**, never commit
it, and treat it like a password.

A session can stop working over time — if you terminate it from Telegram's *Active sessions*,
the account signs it out, you change your 2FA password, the forwarder stays offline past the
account's "auto-terminate inactive sessions" window, or Telegram revokes it. When that
happens the dashboard shows **`session_expired`** (the server probes the session periodically
to detect this). Reconnecting won't help — re-run `npm run telegram:login`, update
`TELEGRAM_SESSION`, and restart.

## Environment variables

See [`.env.example`](.env.example) for the full template.

| Variable                | Required | Default                  | Notes                                                  |
| ----------------------- | -------- | ------------------------ | ------------------------------------------------------ |
| `NODE_ENV`              | no       | `development`            | `production` in Docker                                 |
| `PORT`                  | no       | `3000`                   | HTTP port                                              |
| `PUBLIC_URL`            | no       | `http://localhost:3000`  | Used for prod cookie/CORS; set `https://` in prod      |
| `DATABASE_URL`          | **yes**  | `file:./prisma/dev.db`   | Docker overrides to `file:/data/forwarder.db`          |
| `ADMIN_USERNAME`        | no       | `admin`                  | Created on first boot if no admin exists               |
| `ADMIN_PASSWORD`        | **yes**  | —                        | Set a strong value                                     |
| `SESSION_SECRET`        | **yes**  | —                        | ≥ 16 chars; signs the auth cookie/JWT                  |
| `TELEGRAM_API_ID`       | no\*     | —                        | From my.telegram.org                                   |
| `TELEGRAM_API_HASH`     | no\*     | —                        | From my.telegram.org                                   |
| `TELEGRAM_SESSION`      | no\*     | —                        | From `telegram:login`; **secret**                      |
| `FORWARD_MAX_ATTEMPTS`  | no       | `5`                      | Retries before a message is marked `FAILED`            |
| `DISCORD_RATE_PER_MIN`  | no       | `25`                     | Per-webhook send rate (Discord allows ~30/min)         |
| `DISCORD_MAX_UPLOAD_MB` | no       | `8`                      | Larger photos are skipped (text still forwards)        |

\* All three Telegram values are required **together** for ingestion to run; omit them and
the dashboard still works.

## Docker deployment

```bash
# 1. Configure env (DATABASE_URL, PORT, NODE_ENV are set by compose — leave the rest)
cp .env.example .env
#    → set ADMIN_PASSWORD, SESSION_SECRET, and the TELEGRAM_* values

# 2. Build and start
docker compose up -d --build

# 3. Dashboard is now on http://localhost:3000
```

- Migrations are applied automatically on container start.
- The SQLite database lives in the named volume `forwarder-data` (`/data` in the
  container), so it **survives rebuilds and restarts**.
- `docker compose` reads `.env`, but forces `NODE_ENV=production`, `PORT=3000`, and
  `DATABASE_URL=file:/data/forwarder.db`.

**First Telegram login under Docker** — generate the session interactively, then put it in
`.env` and restart:

```bash
docker compose run --rm app /app/node_modules/.bin/tsx apps/server/src/telegram/login.ts
# paste the printed TELEGRAM_SESSION into .env, then:
docker compose up -d
```

(Or run `npm run telegram:login` on your host and copy the value over.)

## Dashboard

- **Login** — username / password (the admin from your env).
- **Overview** — route count, messages today, failures, Telegram connection, last activity.
- **Routes** — create / edit / delete; pick a source from your Telegram dialogs (or type an
  id/`@username`), set the webhook + name/avatar override, toggle text/photos, add keyword
  filters, and **Test** the webhook.
- **Logs** — filter by route/status, search content, and **retry** failed messages.
- **Settings** — Telegram connection status and app info.

All views update live via Server-Sent Events.

## Project structure

```
apps/
  server/   Fastify API + Telegram ingestion + forward queue (runs via tsx)
    src/
      api/          REST routes + SSE + auth
      telegram/     GramJS client, listener, login CLI, dialogs
      forwarder/    router, transform (TG→MD), send queue
      discord/      webhook sender
      db/           Prisma client + seed
    prisma/         schema + migrations
  web/      React + Vite dashboard (built to apps/web/dist, served by the server in prod)
packages/
  shared/   shared TypeScript types (DTOs)
Dockerfile · docker-compose.yml · .env.example
```

## npm scripts (root)

| Script                    | What it does                                          |
| ------------------------- | ----------------------------------------------------- |
| `npm run dev`             | Server + dashboard with hot reload                    |
| `npm run build`           | Build the dashboard (`apps/web/dist`)                 |
| `npm start`               | Run the server (serves the built dashboard)           |
| `npm run telegram:login`  | Interactive Telegram login → prints `TELEGRAM_SESSION`|
| `npm run prisma:migrate`  | Create/update the local SQLite schema (dev)           |
| `npm run prisma:deploy`   | Apply migrations (production / CI)                    |
| `npm run db:seed`         | Ensure the initial admin user exists                  |
| `npm test`                | Run unit tests (transform + message splitting)        |

## Security notes

- Secrets (`SESSION_SECRET`, `TELEGRAM_SESSION`, webhook URLs, passwords) belong in `.env`,
  which is git-ignored. Never commit them. The session string and webhook URLs are
  especially sensitive — they're not written to logs.
- Auth uses a JWT in an httpOnly, SameSite=Lax cookie; the login endpoint is rate-limited.
- Webhook URLs are validated against Discord's format before saving.
```
