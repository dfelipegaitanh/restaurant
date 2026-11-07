// ============================================================================
// lib/events/eventHub.ts — Realtime EventHub Singleton & SSE Registry
// ============================================================================

import { EventEmitter } from 'node:events';
import { RealtimeEvent } from '@/types/events';

export interface SSEClient {
  id: string;
  send: (chunk: string) => void;
  close: () => void;
  connectedAt: Date;
}

export interface BufferedEvent {
  id: string;
  event: RealtimeEvent;
  timestamp: number;
}

export class RestaurantEventHub extends EventEmitter {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private readonly heartbeatIntervalMs: number = 15000; // 15 seconds
  private eventRingBuffer: BufferedEvent[] = [];
  private readonly maxBufferSize: number = 50;
  private eventCounter: number = 0;

  constructor() {
    super();
    // Allow unlimited listeners for high tablet / KDS density
    this.setMaxListeners(0);
  }

  /**
   * Registers an active SSE client stream.
   * Automatically starts the centralized heartbeat if this is the first client.
   * Returns an unregister cleanup function.
   */
  public registerClient(client: SSEClient): () => void {
    this.clients.set(client.id, client);

    // Start heartbeat if not running
    if (this.clients.size > 0 && !this.heartbeatTimer) {
      this.startHeartbeat();
    }

    return () => {
      this.unregisterClient(client.id);
    };
  }

  /**
   * Unregisters a client and cleans up heartbeat timer if no clients remain.
   */
  public unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.close();
      } catch {
        // Ignore if already closed
      }
      this.clients.delete(clientId);
    }

    // Stop heartbeat if no active clients to conserve resources
    if (this.clients.size === 0 && this.heartbeatTimer) {
      this.stopHeartbeat();
    }
  }

  /**
   * Broadcasts a RealtimeEvent to all connected SSE clients
   * and records it in the ring buffer for replay.
   */
  public broadcast(event: RealtimeEvent): void {
    this.eventCounter++;
    const eventId = `${Date.now()}_${this.eventCounter}`;

    // Store in ring buffer
    this.recordEvent(eventId, event);

    // Format SSE frame
    const sseChunk = this.formatSSEFrame(eventId, event);

    // Dispatch to all connected SSE clients
    const failedClientIds: string[] = [];
    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.send(sseChunk);
      } catch {
        failedClientIds.push(clientId);
      }
    }

    // Prune dead clients immediately
    for (const deadId of failedClientIds) {
      this.unregisterClient(deadId);
    }

    // Emit internally for Node listeners / testing harnesses
    this.emit('realtime', event);
    this.emit(event.type, event);
  }

  /**
   * Formats an SSE message frame according to W3C standards:
   * id: <id>
   * event: <type>
   * data: <json>
   * \n
   */
  public formatSSEFrame(eventId: string, event: RealtimeEvent): string {
    const json = JSON.stringify(event);
    return `id: ${eventId}\nevent: ${event.type}\ndata: ${json}\n\n`;
  }

  /**
   * Centralized 15-second heartbeat ping.
   * Sends SSE comment line ": ping\n\n".
   */
  public startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatIntervalMs);

    // Allow Node.js process to exit gracefully during test runners
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
  }

  public stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendHeartbeat(): void {
    const pingChunk = ': ping\n\n';
    const deadClientIds: string[] = [];

    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.send(pingChunk);
      } catch {
        deadClientIds.push(clientId);
      }
    }

    for (const deadId of deadClientIds) {
      this.unregisterClient(deadId);
    }

    this.emit('heartbeat', Date.now());
  }

  /**
   * Retrieves events that occurred after the given eventId (for reconnection recovery).
   */
  public getEventsSince(lastEventId: string): BufferedEvent[] {
    const index = this.eventRingBuffer.findIndex((e) => e.id === lastEventId);
    if (index === -1) {
      return [...this.eventRingBuffer];
    }
    return this.eventRingBuffer.slice(index + 1);
  }

  private recordEvent(id: string, event: RealtimeEvent): void {
    this.eventRingBuffer.push({
      id,
      event,
      timestamp: Date.now(),
    });
    if (this.eventRingBuffer.length > this.maxBufferSize) {
      this.eventRingBuffer.shift();
    }
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public clearAllClients(): void {
    for (const clientId of Array.from(this.clients.keys())) {
      this.unregisterClient(clientId);
    }
    this.stopHeartbeat();
  }
}

// Global Singleton Initialization
declare global {
  // eslint-disable-next-line no-var
  var __restaurant_event_hub__: RestaurantEventHub | undefined;
}

export function getEventHub(): RestaurantEventHub {
  if (!globalThis.__restaurant_event_hub__) {
    globalThis.__restaurant_event_hub__ = new RestaurantEventHub();
  }
  return globalThis.__restaurant_event_hub__;
}

export const eventHub = getEventHub();
