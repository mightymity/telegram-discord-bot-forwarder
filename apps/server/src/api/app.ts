import path from "node:path";
import fs from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { config } from "../config";
import { registerAuth } from "./auth";
import { authRoutes } from "./routes/auth";
import { routeRoutes } from "./routes/routes";
import { messageRoutes } from "./routes/messages";
import { telegramRoutes } from "./routes/telegram";
import { statusRoutes } from "./routes/status";
import { eventRoutes } from "./routes/events";

// Built dashboard, served by the same process in production. The desktop app
// (bundled server lives elsewhere) injects WEB_DIST_PATH; otherwise fall back
// to the monorepo-relative location used in dev/Docker.
const WEB_DIST =
  process.env.WEB_DIST_PATH ?? path.resolve(__dirname, "..", "..", "..", "web", "dist");

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: true,
    logger: config.isProd
      ? true
      : {
          transport: {
            target: "pino-pretty",
            options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
          },
        },
  });

  await app.register(fastifyCors, {
    // Prod serves the dashboard same-origin; dev uses the Vite proxy. Reflecting
    // the origin keeps cookie auth working in both without a wildcard.
    origin: config.isProd ? config.PUBLIC_URL : true,
    credentials: true,
  });
  // Registered globally but off by default; individual routes opt in via config.
  await app.register(fastifyRateLimit, { global: false });
  await registerAuth(app);

  app.get("/api/health", async () => ({ ok: true }));

  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(routeRoutes, { prefix: "/routes" });
      await api.register(messageRoutes, { prefix: "/messages" });
      await api.register(telegramRoutes, { prefix: "/telegram" });
      await api.register(statusRoutes, { prefix: "/status" });
      await api.register(eventRoutes, { prefix: "/events" });
    },
    { prefix: "/api" },
  );

  if (fs.existsSync(WEB_DIST)) {
    await app.register(fastifyStatic, { root: WEB_DIST, prefix: "/" });
    // SPA fallback: serve index.html for non-API, non-file routes.
    app.setNotFoundHandler((request, reply) => {
      if (request.method !== "GET" || request.url.startsWith("/api")) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}
