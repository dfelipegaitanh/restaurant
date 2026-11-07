import { NextRequest } from 'next/server';
import { eventHub } from '@/lib/events/eventHub';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const clientId = crypto.randomUUID();
  const lastEventId =
    request.headers.get('last-event-id') || request.nextUrl.searchParams.get('lastEventId');

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial Handshake & Retry Directive
      controller.enqueue(encoder.encode(': connected\n\n'));
      controller.enqueue(encoder.encode('retry: 3000\n\n'));

      // 2. Reconnection Replay (if client sent Last-Event-ID)
      if (lastEventId) {
        const missedEvents = eventHub.getEventsSince(lastEventId);
        for (const item of missedEvents) {
          const frame = eventHub.formatSSEFrame(item.id, item.event);
          controller.enqueue(encoder.encode(frame));
        }
      }

      // 3. Register Client with EventHub
      cleanup = eventHub.registerClient({
        id: clientId,
        connectedAt: new Date(),
        send: (chunk: string) => {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            if (cleanup) {
              cleanup();
              cleanup = null;
            }
          }
        },
        close: () => {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        },
      });

      // 4. Handle Disconnect via Client AbortSignal
      request.signal.addEventListener('abort', () => {
        if (cleanup) {
          cleanup();
          cleanup = null;
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },

    cancel() {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Content-Encoding': 'none',
    },
  });
}
