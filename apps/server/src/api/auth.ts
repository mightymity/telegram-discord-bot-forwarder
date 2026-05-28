import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import { config } from "../config";

export const AUTH_COOKIE = "token";
// Cookie is sent over HTTP in local/docker setups; only mark Secure on https.
export const cookieSecure = config.PUBLIC_URL.startsWith("https://");

// Tell @fastify/jwt the shape of our token so request.user is typed.
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { id: string; username: string };
    user: { id: string; username: string };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// Registers cookie + JWT and exposes an `authenticate` preHandler.
// The JWT lives in an httpOnly cookie so the browser (and EventSource) send it
// automatically without exposing it to client-side JS.
export async function registerAuth(app: FastifyInstance): Promise<void> {
  await app.register(fastifyCookie);
  await app.register(fastifyJwt, {
    secret: config.SESSION_SECRET,
    cookie: { cookieName: AUTH_COOKIE, signed: false },
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ error: "Unauthorized" });
    }
  });
}
