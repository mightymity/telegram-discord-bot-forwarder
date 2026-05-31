import { config } from "./config";
import { disconnectPrisma } from "./db/prisma";
import { ensureSqliteDatabaseFile } from "./db/ensure-sqlite";
import { applyMigrations } from "./db/migrate";
import { ensureAdminUser } from "./auth";
import { buildApp } from "./api/app";
import { startTelegram, stopTelegram } from "./telegram/client";
import { handleNewMessage } from "./telegram/listener";
import { requeuePending } from "./forwarder/queue";

async function main(): Promise<void> {
  // Ensure the SQLite file exists and the schema is migrated before any query.
  // In dev this is a no-op (prisma migrate already ran); in the packaged desktop
  // app this is what creates the schema on a fresh user database.
  ensureSqliteDatabaseFile();
  applyMigrations();

  await ensureAdminUser();

  const requeued = await requeuePending();

  const app = await buildApp();
  if (requeued > 0) app.log.info(`Re-queued ${requeued} pending message(s) from previous run`);

  await app.listen({ port: config.PORT, host: "0.0.0.0" });

  if (!config.telegramConfigured) {
    app.log.warn("Telegram credentials not set — ingestion is disabled (dashboard still works)");
  }

  // Start ingestion after the HTTP server is up so the dashboard stays reachable
  // even if Telegram fails to connect.
  startTelegram(handleNewMessage).catch((err: unknown) => {
    app.log.error({ err }, "Telegram client failed to start");
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info(`Received ${signal}, shutting down`);
    await stopTelegram().catch(() => undefined);
    await app.close().catch(() => undefined);
    await disconnectPrisma().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error:", err);
  process.exit(1);
});
