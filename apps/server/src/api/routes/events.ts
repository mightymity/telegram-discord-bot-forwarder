import type { FastifyInstance } from "fastify";
import { bus } from "../../events";
import type { ServerEvent } from "@forwarder/shared";

export async function eventRoutes(app: FastifyInstance): Promise<void> {
  // Server-Sent Events stream. EventSource can't set headers, so auth rides on
  // the httpOnly cookie (same-origin). The preHandler runs before we hijack.
  app.get("/", { preHandler: [app.authenticate] }, (request, reply) => {
    reply.hijack();

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      // Disable proxy buffering (nginx) so events flush immediately.
      "X-Accel-Buffering": "no",
    });
    reply.raw.write("retry: 3000\n\n");

    const send = (event: ServerEvent): void => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    const unsubscribe = bus.subscribe(send);

    // Comment heartbeat keeps idle connections (and proxies) from timing out.
    const keepAlive = setInterval(() => reply.raw.write(": ping\n\n"), 25_000);

    request.raw.on("close", () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });
}
