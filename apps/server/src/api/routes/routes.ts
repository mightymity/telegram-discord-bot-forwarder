import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { toRouteDTO } from "../../mappers";
import { sendToWebhook, DiscordSendError } from "../../discord/webhook";

// A Discord webhook URL (discord.com / discordapp.com, incl. ptb/canary).
const discordWebhookRe =
  /^https:\/\/([a-z]+\.)?discord(app)?\.com\/api\/(v\d+\/)?webhooks\/\d+\/[\w-]+$/i;

const RouteInputSchema = z.object({
  name: z.string().min(1).max(100),
  tgSourceId: z.string().min(1),
  tgSourceTitle: z.string().nullish(),
  discordWebhook: z.string().regex(discordWebhookRe, "Must be a Discord webhook URL"),
  discordName: z.string().max(80).nullish(),
  discordAvatar: z.string().nullish(),
  enabled: z.boolean().optional(),
  forwardText: z.boolean().optional(),
  forwardPhotos: z.boolean().optional(),
  includeKeywords: z.string().nullish(),
  excludeKeywords: z.string().nullish(),
});

const emptyToNull = (v: string | null | undefined): string | null =>
  v == null || v.trim() === "" ? null : v;

type RouteInput = z.infer<typeof RouteInputSchema>;

function toCreateData(d: RouteInput) {
  return {
    name: d.name,
    tgSourceId: d.tgSourceId,
    tgSourceTitle: emptyToNull(d.tgSourceTitle),
    discordWebhook: d.discordWebhook,
    discordName: emptyToNull(d.discordName),
    discordAvatar: emptyToNull(d.discordAvatar),
    includeKeywords: emptyToNull(d.includeKeywords),
    excludeKeywords: emptyToNull(d.excludeKeywords),
    ...(d.enabled !== undefined ? { enabled: d.enabled } : {}),
    ...(d.forwardText !== undefined ? { forwardText: d.forwardText } : {}),
    ...(d.forwardPhotos !== undefined ? { forwardPhotos: d.forwardPhotos } : {}),
  };
}

function toUpdateData(d: Partial<RouteInput>) {
  const data: Record<string, unknown> = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.tgSourceId !== undefined) data.tgSourceId = d.tgSourceId;
  if (d.tgSourceTitle !== undefined) data.tgSourceTitle = emptyToNull(d.tgSourceTitle);
  if (d.discordWebhook !== undefined) data.discordWebhook = d.discordWebhook;
  if (d.discordName !== undefined) data.discordName = emptyToNull(d.discordName);
  if (d.discordAvatar !== undefined) data.discordAvatar = emptyToNull(d.discordAvatar);
  if (d.enabled !== undefined) data.enabled = d.enabled;
  if (d.forwardText !== undefined) data.forwardText = d.forwardText;
  if (d.forwardPhotos !== undefined) data.forwardPhotos = d.forwardPhotos;
  if (d.includeKeywords !== undefined) data.includeKeywords = emptyToNull(d.includeKeywords);
  if (d.excludeKeywords !== undefined) data.excludeKeywords = emptyToNull(d.excludeKeywords);
  return data;
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err &&
    (err as { code?: string }).code === "P2025";
}

export async function routeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", app.authenticate);

  app.get("/", async () => {
    const routes = await prisma.route.findMany({ orderBy: { createdAt: "asc" } });
    return routes.map(toRouteDTO);
  });

  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const route = await prisma.route.findUnique({ where: { id } });
    if (!route) return reply.code(404).send({ error: "Route not found" });
    return toRouteDTO(route);
  });

  app.post("/", async (request, reply) => {
    const parsed = RouteInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid route", details: parsed.error.issues });
    }
    const route = await prisma.route.create({ data: toCreateData(parsed.data) });
    return reply.code(201).send(toRouteDTO(route));
  });

  app.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = RouteInputSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid route", details: parsed.error.issues });
    }
    try {
      const route = await prisma.route.update({ where: { id }, data: toUpdateData(parsed.data) });
      return toRouteDTO(route);
    } catch (err) {
      if (isNotFound(err)) return reply.code(404).send({ error: "Route not found" });
      throw err;
    }
  });

  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.route.delete({ where: { id } });
      return reply.code(204).send();
    } catch (err) {
      if (isNotFound(err)) return reply.code(404).send({ error: "Route not found" });
      throw err;
    }
  });

  // Fire a one-off message at the route's webhook to confirm it works.
  app.post("/:id/test", async (request, reply) => {
    const { id } = request.params as { id: string };
    const route = await prisma.route.findUnique({ where: { id } });
    if (!route) return reply.code(404).send({ error: "Route not found" });

    try {
      await sendToWebhook({
        webhookUrl: route.discordWebhook,
        content: `✅ Test message from the Forwarder dashboard for route **${route.name}**.`,
        username: route.discordName,
        avatarUrl: route.discordAvatar,
      });
      return { ok: true };
    } catch (err) {
      const status = err instanceof DiscordSendError ? err.status : 502;
      const message = err instanceof Error ? err.message : "Failed to reach Discord webhook";
      return reply.code(502).send({ ok: false, status, error: message });
    }
  });
}
