import type { Api } from "telegram";
import type { NewMessageEvent } from "telegram/events";
import type { Route } from "@prisma/client";
import { prisma } from "../db/prisma";
import { bus } from "../events";
import { config } from "../config";
import { toMessageLogDTO } from "../mappers";
import { findRoutesForChat, passesKeywordFilters } from "../forwarder/router";
import { telegramToDiscordMarkdown, type TgEntity } from "../forwarder/transform";
import { enqueue, type ForwardJob } from "../forwarder/queue";
import type { WebhookFile } from "../discord/webhook";

function hasPhoto(message: Api.Message): boolean {
  return Boolean(message.photo);
}

async function downloadPhoto(message: Api.Message): Promise<WebhookFile | null> {
  const data = await message.downloadMedia();
  if (!data) return null;
  const buf = typeof data === "string" ? Buffer.from(data, "binary") : Buffer.from(data);
  const maxBytes = config.DISCORD_MAX_UPLOAD_MB * 1024 * 1024;
  if (buf.byteLength > maxBytes) return null; // too large for this Discord webhook
  return { name: "image.jpg", data: buf, contentType: "image/jpeg" };
}

async function ingestForRoute(
  route: Route,
  message: Api.Message,
  ctx: { chatId: string; messageId: string; tgDate: Date; rawText: string; markdown: string; photo: boolean },
): Promise<void> {
  const wantText = route.forwardText && ctx.markdown.trim().length > 0;
  const wantPhoto = route.forwardPhotos && ctx.photo;
  if (!wantText && !wantPhoto) return; // nothing relevant for this route

  const filtered = !passesKeywordFilters(ctx.rawText, route);

  let log;
  try {
    log = await prisma.messageLog.create({
      data: {
        routeId: route.id,
        tgChatId: ctx.chatId,
        tgMessageId: ctx.messageId,
        contentText: wantText ? ctx.markdown : null,
        hasPhoto: wantPhoto,
        status: filtered ? "SKIPPED" : "PENDING",
        error: filtered ? "Filtered by keyword rules" : null,
        tgDate: ctx.tgDate,
      },
    });
  } catch (err: unknown) {
    // Unique constraint (routeId, tgChatId, tgMessageId) -> already ingested.
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2025") return;
    if (typeof err === "object" && err && "code" in err && (err as { code?: string }).code === "P2002") return;
    throw err;
  }

  bus.publish({ type: "message.created", log: toMessageLogDTO(log, route.name) });
  if (filtered) return;

  let file: WebhookFile | null = null;
  if (wantPhoto) {
    try {
      file = await downloadPhoto(message);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[ingest] photo download failed for msg ${ctx.messageId}:`, err);
    }
  }

  const job: ForwardJob = {
    logId: log.id,
    routeName: route.name,
    webhook: route.discordWebhook,
    content: wantText ? ctx.markdown : "",
    username: route.discordName,
    avatarUrl: route.discordAvatar,
    file,
    attempts: 0,
  };
  enqueue(job);
}

// Entry point registered with the Telegram client for every new message.
export async function handleNewMessage(event: NewMessageEvent): Promise<void> {
  const message = event.message;
  const chatId = message.chatId?.toString();
  if (!chatId) return;

  const routes = await findRoutesForChat(chatId);
  if (routes.length === 0) return;

  const rawText = message.message ?? "";
  const entities = (message.entities ?? []) as unknown as TgEntity[];
  const markdown = telegramToDiscordMarkdown(rawText, entities);
  const photo = hasPhoto(message);
  const ctx = {
    chatId,
    messageId: message.id.toString(),
    tgDate: new Date(message.date * 1000),
    rawText,
    markdown,
    photo,
  };

  for (const route of routes) {
    await ingestForRoute(route, message, ctx).catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error(`[ingest] route ${route.id} failed:`, err);
    });
  }
}
