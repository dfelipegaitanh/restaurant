# Handoff Report: Milestone 1 Realtime EventHub & SSE Plan

**Agent:** teamwork_explorer (`m1_explorer_3`)  
**Role:** Realtime EventHub & Server-Sent Events Specialist  
**Task:** Investigation & Implementation Plan for M1 Realtime EventHub (`lib/events/eventHub.ts`), SSE Route Handler (`app/api/realtime/route.ts`), Lifecycle Event Emission, and Client Reconnection Resilience.  
**Date:** 2026-11-06T20:46:00Z  
**Type:** Hard Handoff (Investigation & Architecture Design Complete)

---

## 1. Observation

1. **System & Tooling Verification**:
   Direct execution of `node -v && npm -v` verified:
   - Node version: `v22.11.0` (Native `node:events`, `node:test`, `ReadableStream`, `TextEncoder`, `crypto.randomUUID()`, `--experimental-strip-types`).
   - npm version: `10.9.0`.
2. **Repository Baseline**:
   - Inspected root `/Users/felipegaitan/projects/restaurant` using `list_dir`. The directory is greenfield: only `.agents` exists. No implementation code or test files have been written yet.
3. **Architecture Specification Directives**:
   - `PROJECT.md` lines 18-19, 133-140, 151:
     - Realtime endpoint: `GET /api/realtime: SSE stream (text/event-stream). Emits RealtimeEvent JSON lines.`
     - Event union:
       ```typescript
       export type RealtimeEvent =
         | { type: 'ORDER_CREATED'; payload: { order: OrderSummary } }
         | { type: 'ORDER_STATUS_CHANGED'; payload: { order_id: string; table_id: string; old_status: OrderStatus; new_status: OrderStatus } }
         | { type: 'TABLE_STATUS_CHANGED'; payload: { table_id: string; status: TableStatus } }
         | { type: 'PAYMENT_COMPLETED'; payload: { table_id: string; bill_id: string; amount: number } };
       ```
   - `ORIGINAL_REQUEST.md` lines 15, 31-32:
     - KDS `/cocina` requires real-time Kanban updates without manual page refreshes, and synthetic Web Audio chimes upon order arrival.
   - `survey_miner_db/report.md` line 46:
     - Duplicate submissions with identical `idempotency_key` must return HTTP 200 with `is_duplicate: true` / `replayed: true` without inserting duplicate rows and without emitting duplicate events to the kitchen.
   - `survey_miner_ui/report.md` lines 235-293:
     - KDS audio alerts triggered by `order:created` / `ORDER_CREATED` event using Web Audio API synthesis.
   - `survey_explorer_infra/report.md` lines 130-136:
     - E2E test `full-flow.test.ts` connects to `/api/realtime` via SSE and asserts `type === 'ORDER_CREATED'` and `type === 'ORDER_STATUS_CHANGED'`.

---

## 2. Logic Chain

1. **Next.js HMR vs Node EventEmitter (Observation 1 & 2)**:
   - In Next.js App Router development mode (`next dev`), modules are re-evaluated upon hot-reloading. If an `EventEmitter` is exported directly as an instantiated object (`new EventEmitter()`), every route compilation produces a separate instance.
   - SSE clients connected in `app/api/realtime/route.ts` would listen to one instance, while `POST /api/orders` would emit to another, resulting in lost events.
   - Attaching the instance to `globalThis.__restaurant_event_hub__` guarantees a single shared singleton across all route handlers and hot-reload cycles.
2. **Web Streams API in Route Handlers (Observation 1 & 3)**:
   - Returning a Web-standard `Response` wrapping a `ReadableStream<Uint8Array>` with `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, and `X-Accel-Buffering: no` ensures low-latency byte-by-byte streaming without reverse proxy buffering.
   - `export const dynamic = 'force-dynamic'` and `export const runtime = 'nodejs'` prevent Next.js from caching or static-rendering the route.
3. **Keep-Alive Comments & Heartbeat Timing (Observation 1 & 3)**:
   - Mobile tablets and restaurant Wi-Fi are prone to silent socket drops. Firewalls and proxies drop idle connections after 30-60s.
   - Emitting an SSE comment `: ping\n\n` every 15 seconds keeps the TCP pipe active. If the connection is lost, write failure or TCP keep-alive resets the socket immediately so the browser's `EventSource` can trigger automatic reconnection.
   - Auto-starting the heartbeat timer on the first client and clearing it when `clients.size === 0` prevents idle CPU wakeups during restaurant off-hours.
4. **Idempotency Guard on Broadcast (Observation 3)**:
   - When 5 rapid clicks arrive for the same comanda, the first insert succeeds (HTTP 201) and broadcasts `ORDER_CREATED`.
   - The subsequent 4 requests encounter unique key violation on `idempotency_key`, returning HTTP 200 with `X-Idempotent-Replay: true`.
   - By verifying `!result.replayed` before calling `eventHub.broadcast()`, the kitchen chime and ticket creation fire exactly once.
5. **Reconnection & Resilience (Observation 1 & 3)**:
   - Providing `retry: 3000\n\n` instructs browsers to retry reconnects every 3 seconds.
   - Storing the last 50 events in a circular ring buffer allows clients reconnecting with `Last-Event-ID` to replay missed events.
   - Listening to `request.signal.addEventListener('abort')` ensures controllers and client references are cleaned up immediately when tabs are closed, preventing memory leaks and `MaxListenersExceededWarning`.

---

## 3. Caveats

1. **Single-Node In-Memory Limitation**:
   - `eventHub.ts` uses an in-memory Node `EventEmitter`. This is optimal for single-process deployments (local dev, test runners, single-container Cloud Run or VPS).
   - If scaled horizontally across multiple load-balanced container instances in the future, event distribution would require a Redis Pub/Sub or PostgreSQL `LISTEN/NOTIFY` bridge (which `survey_miner_db` already documented in DDL trigger `trg_order_notify`). For current M1-M5 requirements, in-memory singleton satisfies all specifications with zero external dependencies.
2. **Browser Autoplay Sound Policy**:
   - Even though the SSE stream reliably delivers `ORDER_CREATED` within milliseconds, browser autoplay policies require a user interaction (tap/click) before `AudioContext` can play sound. The KDS spec in `survey_miner_ui` addresses this with an audio unlock banner.
3. **No other caveats.**

---

## 4. Conclusion

The architecture, code contracts, and integration points for Milestone 1 Realtime EventHub & SSE are fully resolved and documented in `/Users/felipegaitan/projects/restaurant/.agents/teamwork/m1_explorer_3/report.md`.

Ready for implementation:
1. `lib/events/eventHub.ts`: Singleton `RestaurantEventHub` with client registry, 15s keep-alive comments, 50-event ring buffer, and `globalThis` persistence.
2. `app/api/realtime/route.ts`: SSE route handler with `ReadableStream`, `text/event-stream`, `request.signal` abort handling, and `retry: 3000` header.
3. `app/api/orders/route.ts` & `app/api/orders/[id]/status/route.ts`: Idempotent event broadcasting on `ORDER_CREATED` and `ORDER_STATUS_CHANGED`.

---

## 5. Verification Method

To independently verify the implementation once coded:

1. **Unit / Integration Verification Command**:
   ```bash
   node --experimental-strip-types --test tests/integration/realtime.test.ts
   ```
   - Verifies client registration, 15s heartbeat comment delivery, event broadcasting, and ring buffer replay.
2. **End-to-End Route Verification Command**:
   ```bash
   node --experimental-strip-types --test tests/e2e/realtime-sse.test.ts
   ```
   - Connects to `http://localhost:3000/api/realtime` via `fetch`.
   - Asserts HTTP 200, `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`.
   - Reads stream reader to assert `: connected\n\n` and `retry: 3000\n\n`.
3. **Invalidation Conditions**:
   - `eventHub.broadcast()` called on duplicate `idempotency_key` submissions (invalidates idempotency acceptance criteria).
   - Missing `request.signal.onabort` cleanup resulting in Node `MaxListenersExceededWarning` or unhandled controller write exceptions.
   - Omission of `globalThis` singleton resulting in disconnected listeners during Next.js dev HMR.
