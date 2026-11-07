## 2026-11-06T23:32:51Z

You are teamwork_worker implementing the frontend user interfaces for Milestones M2, M3, and M4.
Working directory: /Users/felipegaitan/projects/restaurant/.agents/teamwork/frontend_ui_worker/

MANDATORY INPUTS:
- Read /Users/felipegaitan/projects/restaurant/.agents/teamwork/ORIGINAL_REQUEST.md first (verbatim user requirements).
- Read /Users/felipegaitan/projects/restaurant/.agents/teamwork/PROJECT.md.
- Read frontend survey report: /Users/felipegaitan/projects/restaurant/.agents/teamwork/survey_miner_ui/report.md.
- Read roles:
  - /Users/felipegaitan/projects/restaurant/.agents/roles/tablet-ui.md
  - /Users/felipegaitan/projects/restaurant/.agents/roles/kds-engineer.md
- Skill instructions: Read /Users/felipegaitan/.gemini/config/plugins/modern-web-guidance-plugin/skills/modern-web-guidance/SKILL.md for modern web standards (<dialog>, accessibility, view transitions).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

WRITE OWNERSHIP:
You own exclusively:
- /Users/felipegaitan/projects/restaurant/app/mesa/ (all components and pages under app/mesa/)
- /Users/felipegaitan/projects/restaurant/app/cocina/ (all components and pages under app/cocina/)
- /Users/felipegaitan/projects/restaurant/app/caja/ (all components and pages under app/caja/)
- /Users/felipegaitan/projects/restaurant/app/page.tsx (Navigation hub)
- /Users/felipegaitan/projects/restaurant/lib/utils/ (audio.ts, wakeLock.ts, formatters.ts)
DO NOT touch /lib/db/ or tests/.

OBJECTIVE:
Implement the complete, responsive, interactive frontend in Next.js (TypeScript + Tailwind CSS):

1. Utilities in lib/utils/:
   - lib/utils/audio.ts: Synthetic dual-tone chime using Web Audio API (D5 587.33Hz for 150ms -> A5 880Hz for 300ms) with zero external MP3/audio files.
   - lib/utils/wakeLock.ts: Screen Wake Lock API helper (navigator.wakeLock.request('screen')) with automatic re-acquisition on document.visibilitychange and fallback warning.

2. Vista Cliente (/mesa/[id] - M2):
   - app/mesa/[id]/page.tsx + components:
     - Table validation & header showing Table number and current dining session.
     - Category filter tabs and product cards grid with prices, photos, and customization triggers.
     - Dish customization modal: MUST use the native HTML5 <dialog> element with .showModal(), light-dismiss (closing when clicking backdrop), ESC key handling, touch-friendly min 48x48px targets.
     - Modifiers selection: Render modifier groups (e.g. doneness, extra cheese, no onions, sides). Validate min/max selection bounds before allowing "Agregar al Pedido". Compute price delta live.
     - Persistent Shopping Cart in localStorage keyed by table_id. Allows updating quantities, removing items, and inspecting customized modifier breakdown.
     - Idempotency & Checkout: Generate client-side UUID v4 (crypto.randomUUID()) per order submission. Implement double-click guard (disable button immediately, display loading state). On submit, calls POST /api/orders. If network retry occurs with same key, handles replay gracefully. Clear cart upon 201 Created or 200 Replayed.

3. Vista Cocina / KDS (/cocina - M3):
   - app/cocina/page.tsx + components:
     - Real-time Kanban board with 4 columns: 'PENDING' (Pendiente), 'IN_PREP' (En Preparación), 'READY' (Listo), 'SERVED' (Entregado).
     - SSE Connection: Connect to /api/realtime via new EventSource('/api/realtime'). Automatically update board cards on ORDER_CREATED and ORDER_STATUS_CHANGED without full page reloads. Reconnection handled cleanly.
     - Audio alert banner: "Activar Alertas Sonoras" banner unlocking Web Audio AudioContext on first user gesture. When new orders arrive, trigger synthetic chime.
     - Screen Wake Lock: Request screen wake lock on mount, release on unmount, auto re-acquire on visibility change. Show status indicator pill (🟢 Pantalla Activa / 🟠 WakeLock no soportado).
     - Preparation timer semáforo: Calculate elapsed minutes since order.created_at. Display color badge:
       * Verde: < 10 minutos
       * Naranja: 10 a 20 minutos
       * Rojo: > 20 minutos
       Update timer every 30 seconds.
     - Status transition actions: Advance button (A Preparación -> Marcar Listo -> Servido), calling PATCH /api/orders/[id]/status. Use View Transitions API (document.startViewTransition) if supported.

4. Vista Caja (/caja - M4):
   - app/caja/page.tsx + components:
     - Table oversight grid (Tables 1 to 8) showing occupancy status (AVAILABLE, OCCUPIED, BILL_REQUESTED, CLOSED).
     - Session aggregation: Clicking an occupied table loads table bill via GET /api/tables/[id]/bill, aggregating all orders placed for that table session.
     - Itemized receipt breakdown: Products, quantities, relational modifiers, and item totals.
     - Financial calculations: Subtotal, 8% Impoconsumo tax, voluntary 10% tip toggle/calculation, and grand total.
     - Payment modal: Record payment method (CASH, CARD, TRANSFER). If CASH, input tendered amount and calculate change due. Calls POST /api/tables/[id]/pay.
     - Table settlement & release: Once paid, button to close table and archive session, calling POST /api/tables/[id]/close, transitioning table back to AVAILABLE.
     - Real-time updates: Listen to SSE /api/realtime for TABLE_STATUS_CHANGED and PAYMENT_COMPLETED.

5. Hub Navigation (app/page.tsx):
   - Clean, modern dashboard linking to:
     - Quick table links (/mesa/1 through /mesa/8).
     - Cocina / KDS (/cocina).
     - Caja / Facturación (/caja).
     - Status of backend & real-time connection.

6. Verification:
   - Run npm run build and ensure Next.js compiles all routes with 0 errors.
   - Run npm test and node --experimental-strip-types scripts/verify-e2e.ts to ensure 100% test pass.

COMPLETION CRITERIA:
All three views fully functional, beautiful Tailwind UI, adhering to modern web guidance, responsive on tablet/desktop. Build passes. Write handoff.md and send completion message.
