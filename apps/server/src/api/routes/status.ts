import type { FastifyInstance } from "fastify";
import { prisma } from "../../db/prisma";
import { getTelegramStatus } from "../../telegram/client";
import type { StatusSummary } from "@forwarder/shared";

export async function statusRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async (): Promise<StatusSummary> => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [totalRoutes, enabledRoutes, today, sentToday, failedToday, pending, last] =
      await Promise.all([
        prisma.route.count(),
        prisma.route.count({ where: { enabled: true } }),
        prisma.messageLog.count({ where: { createdAt: { gte: startOfToday } } }),
        prisma.messageLog.count({ where: { status: "SENT", forwardedAt: { gte: startOfToday } } }),
        prisma.messageLog.count({ where: { status: "FAILED", createdAt: { gte: startOfToday } } }),
        prisma.messageLog.count({ where: { status: "PENDING" } }),
        prisma.messageLog.findFirst({
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);

    return {
      routes: { total: totalRoutes, enabled: enabledRoutes },
      messages: { today, sentToday, failedToday, pending },
      telegram: getTelegramStatus(),
      lastActivityAt: last?.createdAt.toISOString() ?? null,
    };
  });
}
