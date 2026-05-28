import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma";
import { verifyPassword } from "../../auth";
import { AUTH_COOKIE, cookieSecure } from "../auth";
import type { AuthUser } from "@forwarder/shared";

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Throttle login attempts to slow credential stuffing.
  app.post(
    "/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = LoginBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Username and password are required" });
      }

      const { username, password } = parsed.data;
      const user = await prisma.adminUser.findUnique({ where: { username } });
      // Run the hash compare even when the user is missing to avoid leaking
      // which usernames exist via response timing.
      const ok = user
        ? await verifyPassword(password, user.passwordHash)
        : await verifyPassword(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinv");
      if (!user || !ok) {
        return reply.code(401).send({ error: "Invalid username or password" });
      }

      const token = app.jwt.sign(
        { id: user.id, username: user.username },
        { expiresIn: "7d" },
      );
      reply.setCookie(AUTH_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: cookieSecure,
        path: "/",
        maxAge: SEVEN_DAYS_SECONDS,
      });

      const body: AuthUser = { id: user.id, username: user.username };
      return reply.send(body);
    },
  );

  app.post("/logout", async (_request, reply) => {
    reply.clearCookie(AUTH_COOKIE, { path: "/" });
    return reply.send({ ok: true });
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (request) => {
    const body: AuthUser = { id: request.user.id, username: request.user.username };
    return body;
  });
}
