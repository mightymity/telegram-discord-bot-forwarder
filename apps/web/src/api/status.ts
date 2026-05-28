import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { StatusSummary, TelegramDialog, TelegramStatus } from "@forwarder/shared";

export function useStatus() {
  return useQuery({
    queryKey: ["status"],
    queryFn: () => api.get<StatusSummary>("/status"),
    refetchInterval: 30_000,
  });
}

export function useTelegramStatus() {
  return useQuery({
    queryKey: ["telegram-status"],
    queryFn: () => api.get<TelegramStatus>("/telegram/status"),
    refetchInterval: 15_000,
  });
}

// Only fetched on demand (the source picker) since it hits Telegram live.
export function useDialogs(enabled: boolean) {
  return useQuery({
    queryKey: ["dialogs"],
    queryFn: () => api.get<TelegramDialog[]>("/telegram/dialogs"),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}
