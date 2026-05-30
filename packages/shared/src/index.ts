// Shared DTOs / contracts between the server API and the web dashboard.
// Source-only (no build step) — consumed via tsconfig paths (server) and Vite alias (web).

export type ForwardStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export interface RouteDTO {
  id: string;
  name: string;
  tgSourceId: string;
  tgSourceTitle: string | null;
  discordWebhook: string;
  discordName: string | null;
  discordAvatar: string | null;
  enabled: boolean;
  forwardText: boolean;
  forwardPhotos: boolean;
  includeKeywords: string | null;
  excludeKeywords: string | null;
  createdAt: string;
  updatedAt: string;
}

// Payload accepted when creating/updating a route.
export interface RouteInput {
  name: string;
  tgSourceId: string;
  tgSourceTitle?: string | null;
  discordWebhook: string;
  discordName?: string | null;
  discordAvatar?: string | null;
  enabled?: boolean;
  forwardText?: boolean;
  forwardPhotos?: boolean;
  includeKeywords?: string | null;
  excludeKeywords?: string | null;
}

export interface MessageLogDTO {
  id: string;
  routeId: string;
  routeName: string | null;
  tgChatId: string;
  tgMessageId: string;
  contentText: string | null;
  hasPhoto: boolean;
  status: ForwardStatus;
  error: string | null;
  attempts: number;
  tgDate: string;
  forwardedAt: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TelegramDialog {
  id: string;
  title: string;
  type: "channel" | "group" | "user" | "unknown";
  username: string | null;
}

export type TelegramConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "no_session"
  | "session_expired"
  | "error";

export interface TelegramStatus {
  state: TelegramConnectionState;
  username: string | null;
  error: string | null;
}

export interface StatusSummary {
  routes: { total: number; enabled: number };
  messages: { today: number; sentToday: number; failedToday: number; pending: number };
  telegram: TelegramStatus;
  lastActivityAt: string | null;
}

export interface AuthUser {
  id: string;
  username: string;
}

// Server-sent event payloads (channel: "message" carries one of these).
export type ServerEvent =
  | { type: "message.created"; log: MessageLogDTO }
  | { type: "message.updated"; log: MessageLogDTO }
  | { type: "telegram.status"; status: TelegramStatus };
