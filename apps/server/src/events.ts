import { EventEmitter } from "node:events";
import type { ServerEvent } from "@forwarder/shared";

// In-process pub/sub used to push live updates to connected SSE clients.
class EventBus extends EventEmitter {
  publish(event: ServerEvent): void {
    this.emit("event", event);
  }

  // Returns an unsubscribe function.
  subscribe(listener: (event: ServerEvent) => void): () => void {
    this.on("event", listener);
    return () => this.off("event", listener);
  }
}

export const bus = new EventBus();
// SSE can have many concurrent subscribers; lift the default cap.
bus.setMaxListeners(0);
