import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  TelegramLoginStartInput,
  TelegramLoginStartResult,
  TelegramLoginVerifyInput,
  TelegramLoginVerifyResult,
  TelegramStatus,
} from "@forwarder/shared";

export function useStartLogin() {
  return useMutation({
    mutationFn: (input: TelegramLoginStartInput) =>
      api.post<TelegramLoginStartResult>("/telegram/login/start", input),
  });
}

export function useVerifyLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TelegramLoginVerifyInput) =>
      api.post<TelegramLoginVerifyResult>("/telegram/login/verify", input),
    onSuccess: (result) => {
      // Only a completed login (not the "needs password" step) changes state.
      if ("status" in result) {
        qc.invalidateQueries({ queryKey: ["telegram-status"] });
        qc.invalidateQueries({ queryKey: ["dialogs"] });
        qc.invalidateQueries({ queryKey: ["status"] });
      }
    },
  });
}

export function useTelegramLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<TelegramStatus>("/telegram/logout"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["telegram-status"] });
      qc.invalidateQueries({ queryKey: ["dialogs"] });
      qc.invalidateQueries({ queryKey: ["status"] });
    },
  });
}
