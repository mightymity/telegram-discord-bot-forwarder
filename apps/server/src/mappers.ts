import type { MessageLog, Route } from "@prisma/client";
import type { ForwardStatus, MessageLogDTO, RouteDTO } from "@forwarder/shared";

export function toRouteDTO(route: Route): RouteDTO {
  return {
    id: route.id,
    name: route.name,
    tgSourceId: route.tgSourceId,
    tgSourceTitle: route.tgSourceTitle,
    discordWebhook: route.discordWebhook,
    discordName: route.discordName,
    discordAvatar: route.discordAvatar,
    enabled: route.enabled,
    forwardText: route.forwardText,
    forwardPhotos: route.forwardPhotos,
    includeKeywords: route.includeKeywords,
    excludeKeywords: route.excludeKeywords,
    createdAt: route.createdAt.toISOString(),
    updatedAt: route.updatedAt.toISOString(),
  };
}

export function toMessageLogDTO(
  log: MessageLog,
  routeName: string | null = null,
): MessageLogDTO {
  return {
    id: log.id,
    routeId: log.routeId,
    routeName,
    tgChatId: log.tgChatId,
    tgMessageId: log.tgMessageId,
    contentText: log.contentText,
    hasPhoto: log.hasPhoto,
    status: log.status as ForwardStatus,
    error: log.error,
    attempts: log.attempts,
    tgDate: log.tgDate.toISOString(),
    forwardedAt: log.forwardedAt ? log.forwardedAt.toISOString() : null,
    createdAt: log.createdAt.toISOString(),
  };
}
