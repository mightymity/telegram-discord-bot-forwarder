import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { RouteDTO, RouteInput } from "@forwarder/shared";

export function useRoutes() {
  return useQuery({ queryKey: ["routes"], queryFn: () => api.get<RouteDTO[]>("/routes") });
}

export function useCreateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RouteInput) => api.post<RouteDTO>("/routes", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routes"] }),
  });
}

export function useUpdateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<RouteInput> }) =>
      api.put<RouteDTO>(`/routes/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routes"] }),
  });
}

export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<void>(`/routes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routes"] }),
  });
}

export function useTestRoute() {
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: boolean }>(`/routes/${id}/test`),
  });
}
