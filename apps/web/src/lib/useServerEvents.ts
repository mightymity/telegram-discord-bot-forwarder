import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ServerEvent } from "@forwarder/shared";

// Subscribes to the backend SSE stream and nudges React Query to refetch the
// affected data so the dashboard updates live. EventSource auto-reconnects.
export function useServerEvents(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const es = new EventSource("/api/events", { withCredentials: true });

    es.onmessage = (e: MessageEvent<string>) => {
      let event: ServerEvent;
      try {
        event = JSON.parse(e.data) as ServerEvent;
      } catch {
        return;
      }

      if (event.type === "message.created" || event.type === "message.updated") {
        void qc.invalidateQueries({ queryKey: ["messages"] });
        void qc.invalidateQueries({ queryKey: ["status"] });
      } else if (event.type === "telegram.status") {
        qc.setQueryData(["telegram-status"], event.status);
        void qc.invalidateQueries({ queryKey: ["status"] });
      }
    };

    return () => es.close();
  }, [qc]);
}
