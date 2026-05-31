import type { FastifyInstance } from "fastify";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { computeCheck } from "telegram/Password";
import { LogLevel } from "telegram/extensions/Logger";
import type {
  TelegramLoginStartInput,
  TelegramLoginStartResult,
  TelegramLoginVerifyInput,
  TelegramLoginVerifyResult,
} from "@forwarder/shared";
import { getTelegramStatus, listDialogs, restartTelegram } from "../../telegram/client";
import { saveTelegramCreds, clearTelegramSession } from "../../telegram/credentials-store";
import {
  putPendingLogin,
  getPendingLogin,
  dropPendingLogin,
} from "../../telegram/login-session";

function isSessionPasswordNeeded(err: unknown): boolean {
  const e = err as { errorMessage?: unknown; message?: unknown } | null;
  const text = `${e?.errorMessage ?? ""} ${e?.message ?? ""} ${String(err)}`;
  return text.includes("SESSION_PASSWORD_NEEDED");
}

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

  // Step 1 of the login wizard: connect with the supplied credentials and ask
  // Telegram to send a login code to the account. Keeps the connected client in
  // memory (keyed by an opaque state token) for the verify step.
  app.post<{ Body: TelegramLoginStartInput }>("/login/start", async (request, reply) => {
    const { apiId, apiHash, phone } = request.body ?? ({} as TelegramLoginStartInput);
    if (!apiId || !apiHash || !phone?.trim()) {
      return reply.code(400).send({ error: "apiId, apiHash and phone are required" });
    }

    const client = new TelegramClient(new StringSession(""), Number(apiId), String(apiHash), {
      connectionRetries: 3,
    });
    client.setLogLevel(LogLevel.ERROR);

    try {
      await client.connect();
      const { phoneCodeHash } = await client.sendCode(
        { apiId: Number(apiId), apiHash: String(apiHash) },
        phone.trim(),
      );
      const state = putPendingLogin({
        client,
        apiId: Number(apiId),
        apiHash: String(apiHash),
        phone: phone.trim(),
        phoneCodeHash,
      });
      const result: TelegramLoginStartResult = { state, codeSent: true };
      return result;
    } catch (err) {
      await client.disconnect().catch(() => undefined);
      const message = err instanceof Error ? err.message : "Failed to send login code";
      return reply.code(400).send({ error: message });
    }
  });

  // Step 2: submit the code (and 2FA password if the account requires it).
  // On success, persist the session and hot-reconnect the live client.
  app.post<{ Body: TelegramLoginVerifyInput }>("/login/verify", async (request, reply) => {
    const { state, code, password } = request.body ?? ({} as TelegramLoginVerifyInput);
    if (!state || !code?.trim()) {
      return reply.code(400).send({ error: "state and code are required" });
    }

    const pending = getPendingLogin(state);
    if (!pending) {
      return reply.code(410).send({ error: "Login session expired — start again" });
    }
    const { client, apiId, apiHash, phone, phoneCodeHash } = pending;

    try {
      try {
        await client.invoke(
          new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code.trim() }),
        );
      } catch (err) {
        if (!isSessionPasswordNeeded(err)) throw err;
        // 2FA: ask the UI for the password if we don't have it yet.
        if (!password) {
          const needs: TelegramLoginVerifyResult = { needsPassword: true };
          return needs;
        }
        const pwdInfo = await client.invoke(new Api.account.GetPassword());
        const check = await computeCheck(pwdInfo, password);
        await client.invoke(new Api.auth.CheckPassword({ password: check }));
      }

      const session = String(client.session.save());
      await saveTelegramCreds({ apiId, apiHash, session });
      dropPendingLogin(state); // disconnects the throwaway login client
      await restartTelegram();

      const result: TelegramLoginVerifyResult = { status: getTelegramStatus() };
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to verify login code";
      return reply.code(400).send({ error: message });
    }
  });

  app.post("/logout", async () => {
    await clearTelegramSession();
    await restartTelegram();
    return getTelegramStatus();
  });
}
