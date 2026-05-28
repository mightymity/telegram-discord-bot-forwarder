import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { toMessageLogDTO } from "../../mappers";
import { retryLog } from "../../forwarder/queue";
import type { MessageLogDTO, Paginated } from "@forwarder/shared";

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
  routeId: z.string().optional(),
  status: z.enum(["PENDING", "SENT", "FAILED", "SKIPPED"]).optional(),
});

export async function messageRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (request, reply) => {
    const parsed = ListQuery.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid query", details: parsed.error.issues });
    }
    const { page, pageSize, routeId, status } = parsed.data;
    const where = {
      ...(routeId ? { routeId } : {}),
      ...(status ? { status } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.messageLog.count({ where }),
      prisma.messageLog.findMany({
        where,
        include: { route: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: MessageLogDTO[] = rows.map((r) => toMessageLogDTO(r, r.route?.name ?? null));
    const body: Paginated<MessageLogDTO> = { items, total, page, pageSize };
    return body;
  });

  // Re-queue a FAILED/SKIPPED message (text-only — original media is gone).
  app.post("/:id/retry", async (request, reply) => {
    const { id } = request.params as { id: string };
    const ok = await retryLog(id);
    if (!ok) {
      return reply.code(400).send({ error: "Message cannot be retried" });
    }
    return { ok: true };
  });
}
