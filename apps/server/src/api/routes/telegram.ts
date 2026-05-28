import type { FastifyInstance } from "fastify";
import { getTelegramStatus, listDialogs } from "../../telegram/client";

export async function telegramRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/status", async () => getTelegramStatus());

  // Source picker for the dashboard. 503 when the client isn't connected.
  app.get("/dialogs", async (_request, reply) => {
    try {
      return await listDialogs();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Telegram is not connected";
      return reply.code(503).send({ error: message });
    }
  });
}
