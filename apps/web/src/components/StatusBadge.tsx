import type { ForwardStatus, TelegramConnectionState } from "@forwarder/shared";

export function StatusBadge({ status }: { status: ForwardStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>;
}

const TG_LABEL: Record<TelegramConnectionState, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  disconnected: "Disconnected",
  no_session: "No session",
  error: "Error",
};

export function TelegramBadge({ state }: { state: TelegramConnectionState }) {
  return <span className={`badge tg-${state}`}>{TG_LABEL[state]}</span>;
}
