import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { ForwardStatus, MessageLogDTO, Paginated } from "@forwarder/shared";

export interface MessageQuery {
  page: number;
  pageSize: number;
  routeId?: string;
  status?: ForwardStatus;
}

export function useMessages(params: MessageQuery) {
  return useQuery({
    queryKey: ["messages", params],
    queryFn: () => {
      const qs = new URLSearchParams();
      qs.set("page", String(params.page));
      qs.set("pageSize", String(params.pageSize));
      if (params.routeId) qs.set("routeId", params.routeId);
      if (params.status) qs.set("status", params.status);
      return api.get<Paginated<MessageLogDTO>>(`/messages?${qs.toString()}`);
    },
    placeholderData: keepPreviousData,
  });
}

export function useRetryMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: boolean }>(`/messages/${id}/retry`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}
