import Bottleneck from "bottleneck";
import { prisma } from "../db/prisma";
import { bus } from "../events";
import { config } from "../config";
import { toMessageLogDTO } from "../mappers";
import { sendToWebhook, DiscordSendError, type WebhookFile } from "../discord/webhook";
import { splitMessage } from "./transform";

export interface ForwardJob {
  logId: string;
  routeName: string | null;
  webhook: string;
  content: string;
  username: string | null;
  avatarUrl: string | null;
  file: WebhookFile | null;
  attempts: number;
}

// One limiter per webhook URL — Discord rate limits are per-webhook, so this
// avoids one busy channel throttling the others.
const limiters = new Map<string, Bottleneck>();

function getLimiter(webhook: string): Bottleneck {
  let limiter = limiters.get(webhook);
  if (!limiter) {
    const perMin = config.DISCORD_RATE_PER_MIN;
    limiter = new Bottleneck({
      maxConcurrent: 1,
      minTime: Math.ceil(60_000 / perMin),
      reservoir: perMin,
      reservoirRefreshAmount: perMin,
      reservoirRefreshInterval: 60_000,
    });
    limiters.set(webhook, limiter);
  }
  return limiter;
}

function backoffMs(attempts: number): number {
  // 2s, 4s, 8s, ... capped at 5 min
  return Math.min(2_000 * 2 ** (attempts - 1), 5 * 60_000);
}

async function emitUpdated(logId: string): Promise<void> {
  const log = await prisma.messageLog.findUnique({
    where: { id: logId },
    include: { route: { select: { name: true } } },
  });
  if (log) bus.publish({ type: "message.updated", log: toMessageLogDTO(log, log.route?.name ?? null) });
}

async function markSent(logId: string): Promise<void> {
  await prisma.messageLog.update({
    where: { id: logId },
    data: { status: "SENT", forwardedAt: new Date(), error: null },
  });
  await emitUpdated(logId);
}

async function markSkipped(logId: string, reason: string): Promise<void> {
  await prisma.messageLog.update({
    where: { id: logId },
    data: { status: "SKIPPED", error: reason },
  });
  await emitUpdated(logId);
}

async function markFailed(logId: string, error: string, attempts: number): Promise<void> {
  await prisma.messageLog.update({
    where: { id: logId },
    data: { status: "FAILED", error, attempts },
  });
  await emitUpdated(logId);
}

async function recordRetry(logId: string, error: string, attempts: number): Promise<void> {
  await prisma.messageLog.update({
    where: { id: logId },
    data: { attempts, error },
  });
  await emitUpdated(logId);
}

export function enqueue(job: ForwardJob): void {
  getLimiter(job.webhook)
    .schedule(() => deliver(job))
    .catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error("[queue] scheduling error:", err);
    });
}

async function deliver(job: ForwardJob): Promise<void> {
  // Re-check current state — the route may have been disabled or the log
  // already handled (e.g. a duplicate retry) since it was enqueued.
  const current = await prisma.messageLog.findUnique({ where: { id: job.logId } });
  if (!current || current.status !== "PENDING") return;

  const chunks = splitMessage(job.content);
  if (chunks.length === 0 && !job.file) {
    await markSkipped(job.logId, "Nothing to forward");
    return;
  }

  try {
    if (job.file) {
      await sendToWebhook({
        webhookUrl: job.webhook,
        content: chunks[0],
        file: job.file,
        username: job.username,
        avatarUrl: job.avatarUrl,
      });
      for (const chunk of chunks.slice(1)) {
        await sendToWebhook({
          webhookUrl: job.webhook,
          content: chunk,
          username: job.username,
          avatarUrl: job.avatarUrl,
        });
      }
    } else {
      for (const chunk of chunks) {
        await sendToWebhook({
          webhookUrl: job.webhook,
          content: chunk,
          username: job.username,
          avatarUrl: job.avatarUrl,
        });
      }
    }
    await markSent(job.logId);
  } catch (err) {
    job.attempts += 1;
    const message = err instanceof Error ? err.message : String(err);

    if (job.attempts >= config.FORWARD_MAX_ATTEMPTS) {
      await markFailed(job.logId, message, job.attempts);
      return;
    }

    await recordRetry(job.logId, message, job.attempts);
    const delay =
      err instanceof DiscordSendError && err.retryAfterMs
        ? err.retryAfterMs
        : backoffMs(job.attempts);
    setTimeout(() => enqueue(job), delay);
  }
}

// Manual retry from the dashboard for a FAILED/SKIPPED log. Resets it to
// PENDING and re-queues (text-only — original media bytes are long gone).
// Returns false when the log is missing, its route is gone, or it isn't in a
// retryable state.
export async function retryLog(logId: string): Promise<boolean> {
  const log = await prisma.messageLog.findUnique({
    where: { id: logId },
    include: { route: true },
  });
  if (!log || !log.route) return false;
  if (log.status === "PENDING" || log.status === "SENT") return false;

  await prisma.messageLog.update({
    where: { id: logId },
    data: { status: "PENDING", error: null, attempts: 0, forwardedAt: null },
  });
  await emitUpdated(logId);

  enqueue({
    logId: log.id,
    routeName: log.route.name,
    webhook: log.route.discordWebhook,
    content: log.contentText ?? "",
    username: log.route.discordName,
    avatarUrl: log.route.discordAvatar,
    file: null,
    attempts: 0,
  });
  return true;
}

// On startup, re-queue anything left PENDING (text-only — original media bytes
// are not persisted across restarts).
export async function requeuePending(): Promise<number> {
  const pending = await prisma.messageLog.findMany({
    where: { status: "PENDING" },
    include: { route: true },
    orderBy: { createdAt: "asc" },
  });
  let count = 0;
  for (const log of pending) {
    if (!log.route || !log.route.enabled) continue;
    enqueue({
      logId: log.id,
      routeName: log.route.name,
      webhook: log.route.discordWebhook,
      content: log.contentText ?? "",
      username: log.route.discordName,
      avatarUrl: log.route.discordAvatar,
      file: null,
      attempts: log.attempts,
    });
    count += 1;
  }
  return count;
}
