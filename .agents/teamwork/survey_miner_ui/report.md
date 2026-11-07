# Frontend UI & KDS Specification Mining Report

**Document Version:** 1.0.0  
**Date:** 2026-11-06T20:35:00Z  
**Author:** teamwork_spec_miner (Frontend UI & KDS Specialist)  
**Target Project:** Unified Next.js Restaurant POS & KDS Web App  
**Status:** Approved Specification Survey  

---

## 1. Executive Summary & Authoritative Sources

This specification report documents the complete user interface, interaction flows, modern browser APIs, component hierarchy, client state management, and edge-case handling for the unified Next.js restaurant application.

### Authoritative Specification Sources
1. **`ORIGINAL_REQUEST.md`**: Core requirements for unified Next.js app (`/mesa/[id]`, `/cocina`, `/caja`), relational modifiers, idempotency via UUID, real-time sync, Web Audio API, Screen Wake Lock API, and cashier table closure.
2. **`.agents/roles/tablet-ui.md`**: Customer tablet constraints: native `<dialog>` or Popover API (no heavy React UI libraries), minimum 48px x 48px touch targets, `localStorage` cart persistence, client-side idempotency UUID.
3. **`.agents/roles/kds-engineer.md`**: Kitchen display constraints: Screen Wake Lock API to prevent sleep, View Transitions API for 60 FPS Kanban transitions, synthetic Web Audio API chime (zero MP3/WAV dependencies), 3-tier time semáforo (<10 min green, 10-20 min orange, >20 min red).
4. **`.agents/roles/db-architect.md`**: Order state enum (`PENDING`, `IN_PREP`, `READY`, `SERVED`, `CANCELLED`), relational modifier groups and modifiers structure.
5. **Modern Web Guidance Plugin**: Best practices for HTML5 `<dialog>`, Popover API, light-dismiss, accessibility, zero-dependency audio synthesis, and resilience under network fluctuations.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Tablet UI (`/mesa/[id]`) | Dynamic Table Header | Displays active table identifier, party info, and connection status | URL param `id: string` | Rendered banner with Table # and status badge | Shows 404 or invalid table screen if table does not exist | `ORIGINAL_REQUEST.md`, `tablet-ui.md` |
| 2 | Tablet UI (`/mesa/[id]`) | Category Navigation Bar | Horizontal scrollable tab list for menu categories (Entradas, Fuertes, Bebidas, Postres) | Category list from menu data, user tap | Active tab highlight, auto-scrolls to category section | Default to first category if empty/invalid | UI ergonomics best practice |
| 3 | Tablet UI (`/mesa/[id]`) | Menu Product Card | Touch card displaying product photo/placeholder, title, description, price, tags | Product object `{id, name, price, description, image_url, modifier_groups}` | Card DOM with minimum 48x48px "Personalizar / Agregar" button | Fallback image if image fails to load | `ORIGINAL_REQUEST.md`, `tablet-ui.md` |
| 4 | Tablet UI (`/mesa/[id]`) | Native Modal Modifier Customizer | Native `<dialog>` modal showing item details and nested modifier groups (radios for single-choice, checkboxes for multi-choice) | User clicks item; modifier groups configuration | Open native `<dialog>` via `.showModal()`, focus trap, background backdrop | Falls back to Popover API or inline fallback if dialog unsupported | `ORIGINAL_REQUEST.md`, `tablet-ui.md` |
| 5 | Tablet UI (`/mesa/[id]`) | Modifier Validation & Price Accumulator | Real-time calculation of item total price based on base price plus selected modifier surcharges; enforces required groups | User selections in modifier group | Updated price badge, disabled/enabled "Agregar al Pedido" CTA button | Displays error text if required modifier group (e.g. meat doneness) is unselected | `db-architect.md`, `tablet-ui.md` |
| 6 | Tablet UI (`/mesa/[id]`) | Native Modal Light Dismiss | Modal dismissal via backdrop click, ESC key, or explicit close button without orphaned state | Click on `::backdrop`, ESC key press, or tap "Cancelar" | Modal closes via `dialog.close()`, restores focus to triggering element | Cleanly aborts selection without polluting cart | Modern Web Guidance, `tablet-ui.md` |
| 7 | Tablet UI (`/mesa/[id]`) | Persistent Shopping Cart | Cart stored in `localStorage` keyed by `table_id`; preserves cart across page reloads and tablet reboots | Cart state changes (add, remove, quantity change) | Synced JSON in `localStorage.setItem('restaurant_cart_${tableId}', ...)` | Handles `QuotaExceededError` or corrupted JSON with graceful reset | `tablet-ui.md`, `ORIGINAL_REQUEST.md` |
| 8 | Tablet UI (`/mesa/[id]`) | Quantity Stepper Controls | Increment (+) and decrement (-) buttons with large touch areas (>=48x48px) | Tap `+` or `-` button | Increments count or removes item if count reaches 0 | Prevents negative or non-integer quantities | `tablet-ui.md` |
| 9 | Tablet UI (`/mesa/[id]`) | Client-Side Idempotency Generation | Generates a cryptographically random UUID v4 when preparing the checkout payload | User clicks "Confirmar Pedido" | UUID v4 string attached as `idempotency_key` | Regenerates new UUID only on explicit user cart modification | `ORIGINAL_REQUEST.md`, `tablet-ui.md`, `db-architect.md` |
| 10 | Tablet UI (`/mesa/[id]`) | Anti-Double-Click Checkout Guard | Immediate button disabling and submission state machine (`idle` -> `submitting` -> `success` / `error`) | First click on "Confirmar Pedido" | Disables submit button, displays loading spinner, prevents secondary clicks | Retains existing `idempotency_key` during automated or manual network retry | `reliability-tester.md`, `ORIGINAL_REQUEST.md` |
| 11 | Tablet UI (`/mesa/[id]`) | Order Placement API Call | POST request to `/api/orders` sending table_id, idempotency_key, and items with relational modifier IDs | Valid cart payload and idempotency key | HTTP 201 Created with order ID and initial status `PENDING` | Displays toast/modal with retry option on 5xx or offline; alerts on validation failure | `ORIGINAL_REQUEST.md`, `db-architect.md` |
| 12 | Tablet UI (`/mesa/[id]`) | Order Status Live Tracker | Real-time status display for orders placed at the table (`PENDING` -> `IN_PREP` -> `READY` -> `SERVED`) | Server-Sent Events (SSE) or WebSocket order updates | Visual stepper updating comanda status live | Reconnects SSE stream on disconnect with exponential backoff | `ORIGINAL_REQUEST.md`, `tablet-ui.md` |
| 13 | KDS (`/cocina`) | Realtime Kanban Board | Multi-lane Kanban view with columns: `PENDING` (Pendiente), `IN_PREP` (En Preparación), `READY` (Listo), `SERVED` (Entregado) | Real-time stream of comanda events | Dynamic ticket cards positioned in respective status columns | Re-fetches snapshot on connection re-establishment | `ORIGINAL_REQUEST.md`, `kds-engineer.md` |
| 14 | KDS (`/cocina`) | Screen Wake Lock API Manager | Keeps tablet/monitor display awake indefinitely without OS sleep or screensaver | Initial load / user interaction | `navigator.wakeLock.request('screen')` active lock | Listens to `release` and `visibilitychange` to re-acquire; shows fallback warning | `ORIGINAL_REQUEST.md`, `kds-engineer.md` |
| 15 | KDS (`/cocina`) | Synthetic Web Audio Chime | Zero-dependency synthesized two-tone audio alert on incoming comanda using Web Audio API | Event `order:created` received | Synthesizer plays D5 (587.33Hz) -> A5 (880Hz) chime with exponential decay | Handles browser autoplay policy with "Activar Audio" unlock banner | `ORIGINAL_REQUEST.md`, `kds-engineer.md` |
| 16 | KDS (`/cocina`) | Preparation Time Semáforo | Dynamic color badge and timer indicating elapsed time since order creation | `order.created_at` timestamp vs current time clock | Green (<10 min), Orange (10-20 min), Red/Pulsing (>20 min) | Fallback to neutral gray if timestamp missing/corrupt | `kds-engineer.md` |
| 17 | KDS (`/cocina`) | View Transitions API Lane Shift | Smooth 60 FPS native visual morphing when a card transitions between Kanban lanes | Card status mutation action | `document.startViewTransition(() => updateState())` | Immediate DOM update if `document.startViewTransition` is unsupported | `kds-engineer.md` |
| 18 | KDS (`/cocina`) | Comanda Action Buttons | Large touch buttons to advance comanda lifecycle (`Iniciar Preparación`, `Marcar Listo`, `Entregar`) | Chef touch on card action button | PATCH request `/api/orders/[id]/status` with next state | Optimistic UI update with rollback on network failure | `kds-engineer.md`, `db-architect.md` |
| 19 | KDS (`/cocina`) | Relational Modifier Ticket Display | High-contrast visual differentiation of item additions vs exclusions | Item modifiers array | Green badge with `+ [Nombre]` for extras, Red badge with `- Sin [Nombre]` for removals | Standard badge if modifier type unspecified | `db-architect.md`, `kds-engineer.md` |
| 20 | KDS (`/cocina`) | Audio & Filter Controls Header | Header bar containing Audio Mute/Unmute toggle, Volume control, and lane view filters | Chef tap on header buttons | Updates UI state and persists mute preferences in `localStorage` | Preserves defaults if storage unavailable | UI ergonomics best practice |
| 21 | Cashier (`/caja`) | Floorplan / Table Overview Grid | Grid view of all restaurant tables displaying current occupancy and billing status | Tables list with active order references | Cards showing Table #, status (Libre, Comensales, Cuenta Solicitada), order total | Highlights tables with pending payments | `ORIGINAL_REQUEST.md` |
| 22 | Cashier (`/caja`) | Table Order Aggregator & Itemizer | Aggregates all submitted orders for a specific table session into a single unified bill | Click on table card | Itemized breakdown of all dishes, modifiers, timestamps, and order statuses | Displays warning if some orders are still `PENDING` or `IN_PREP` | `ORIGINAL_REQUEST.md` |
| 23 | Cashier (`/caja`) | Tax & Suggested Tip Calculator | Automatically calculates subtotal, taxes (8% impoconsumo or 19% IVA), and tips (0%, 10%, 15%, custom) | Subtotal from aggregated orders, tip selection | Formatted currency totals (COP / USD) | Enforces positive numbers for custom tip | Colombian POS best practice |
| 24 | Cashier (`/caja`) | Payment Method Selection | Interface to register payment via Cash (Efectivo), Card (Tarjeta), or Digital Wallet (Nequi/Daviplata/Transferencia) | Cashier selection and amount tender input | Calculated change due (Devuelta) for cash, or auth code input for digital | Validates that tendered amount >= total due | `ORIGINAL_REQUEST.md` |
| 25 | Cashier (`/caja`) | Table Closure & Receipt Finalization | Completes payment, marks orders as `PAID`, releases table to `AVAILABLE`, prints/renders receipt | Cashier clicks "Cobrar y Cerrar Mesa" | POST `/api/tables/[id]/close`, clears table session, transitions table to libre | Reversible audit log, rejects closure if unserved orders remain without override | `ORIGINAL_REQUEST.md` |
| 26 | Design System | Touch Ergonomics & Responsive Tablet Layout | Tailwind CSS layout enforcing min 48x48px touch targets, 16px+ base font, high-contrast dark mode for kitchen | Screen size, touch events | Responsive viewport avoiding accidental zoom (`touch-action: manipulation`) | Clean layout without horizontal scrollbars across 768px-1366px tablets | `tablet-ui.md`, `kds-engineer.md` |

---

## 3. Edge Cases & Observed Behaviors

| # | Feature | Input / Scenario | Observed / Specified Behavior |
|---|---------|------------------|-------------------------------|
| 1 | Idempotency & Checkout | User rapidly double-clicks or spams "Confirmar Pedido" 5 times within 300ms | UI disables button immediately on `mousedown`/`touchstart`. Exact same `idempotency_key` is transmitted. Backend receives first request, returns 201; subsequent in-flight or duplicate requests return the same order record or 200/409 duplicate-handled response without duplicate rows. |
| 2 | Network Cut Mid-Checkout | Wi-Fi drops immediately after clicking "Confirmar Pedido" before HTTP response arrives | Client detects `fetch` failure (`TypeError: Failed to fetch`). Displays retry modal with message: "Problema de conexión. Reintentando comanda...". When re-executing `fetch`, the **same** `idempotency_key` is reused. If the server already received the first request, it safely resolves without creating a second order. |
| 3 | Tablet Accidental Reload / Crash | Customer reloads browser or tablet runs out of battery mid-selection | `localStorage` cart state (`restaurant_cart_${tableId}`) is immediately rehydrated on page load. All selected items, quantities, and chosen modifiers remain intact. |
| 4 | Native `<dialog>` on Mobile Safari / Older Tablets | Browser doesn't support `<dialog>` or user taps outside modal backdrop | Native `<dialog>` supported in Safari 15.4+ (Baseline Widely Available). Backdrop click handler calculates click coordinate bounds `(rect.left <= e.clientX <= rect.right)` and calls `dialog.close()` cleanly. ESC key triggers native `cancel` event, clearing active modifier staging state. |
| 5 | Required Modifier Omission | User tries to add a Burger without selecting required "Término de la carne" | Modal displays inline validation message in red ("Seleccione el término de la carne para continuar"). The "Agregar al Pedido" button remains disabled (`disabled` attribute) until all minimum constraints in required modifier groups are satisfied. |
| 6 | Multi-Choice Modifier Cap Limit | Modifier group "Salsas" has rule `max_selection: 2`, user tries to pick 3 | The remaining unselected checkboxes in that group are dynamically disabled once 2 options are checked, preventing invalid submission. |
| 7 | Web Audio Autoplay Policy Block | Kitchen tablet loads `/cocina` without prior user interaction; new comanda arrives | Browser suppresses sound (`AudioContext.state === 'suspended'`). KDS renders a prominent banner: "🔔 Toque aquí para activar las alertas sonoras de cocina". Touching anywhere resumes the `AudioContext` (`await ctx.resume()`), clears the banner, and plays future alerts immediately. |
| 8 | Screen Wake Lock Release on Tab Switch | Kitchen staff switches tab or minimizes browser, then returns to KDS | The OS or browser releases the wake lock (`release` event fires). The application registers a `visibilitychange` listener; when `document.visibilityState === 'visible'`, it automatically calls `navigator.wakeLock.request('screen')` again to re-acquire the lock. |
| 9 | Long Running Comanda (>30 min) | Kitchen gets slammed and order exceeds 20 minutes | Semáforo badge switches to Red (`bg-red-600 text-white animate-pulse`). Elapsed time displays in bold minutes (e.g. `27m`). Card moves to priority visual attention at top/left of the `PENDING` or `IN_PREP` column. |
| 10 | View Transitions Fallback | Older tablet browser lacking `document.startViewTransition` | Feature detection `if (!document.startViewTransition) { updateState(); return; }` ensures the ticket card shifts columns instantly without throwing a JavaScript runtime error. |
| 11 | Cashier Closing Table with Active Kitchen Orders | Cashier attempts to close Mesa 3 while orders are still `IN_PREP` | Cashier UI shows confirmation modal: "Atención: La Mesa 3 tiene comandas en preparación en cocina. ¿Desea cerrar la mesa de todos modos?". Prevents accidental table clearing. |
| 12 | Cart Item with Different Modifiers | User adds Burger with "Extra Queso", then adds another Burger with "Sin Cebolla" | System groups items by composite identity: `hash(item_id, sorted_modifier_ids)`. The cart creates two distinct line items rather than merging them under a single quantity of 2, preserving distinct kitchen ticket instructions. |

---

## 4. Deep Dive: Vista Cliente (`/mesa/[id]`) Specification

### 4.1 Route & State Structure
- **URL Pattern**: `/mesa/[id]` (e.g. `/mesa/4`)
- **Root Layout / Container**: Fullscreen responsive tablet viewport (`h-screen overflow-hidden flex flex-col bg-neutral-900 text-neutral-100 font-sans select-none`).
- **Main Panes**:
  1. **Top Header**: Logo/Restaurant Name, Table Number Badge ("Mesa 04"), Active Order Status indicator, Cart Drawer Toggle with item count badge.
  2. **Category Horizontal Tabs**: Sticky sub-header with large touch pills (`min-h-[48px] px-6 py-3 rounded-full text-base font-semibold`).
  3. **Product Catalog Grid**: 2-column (portrait tablet) or 3-column (landscape tablet) grid with responsive card heights.
  4. **Floating Cart Bar / Sticky Bottom Sheet**: Quick checkout summary showing item count, total price, and "Ver Pedido" / "Confirmar Pedido" button.

### 4.2 Product Detail & Modifiers Modal (`<dialog>`) Spec
Following `tablet-ui.md` and Modern Web Guidance, no heavy external component libraries (like Radix UI, Headless UI, or MUI) are used. The implementation relies on native HTML5 `<dialog>`.

#### Native `<dialog>` Lifecycle & Markup Architecture
```html
<dialog id="modifier-dialog" class="backdrop:bg-black/80 backdrop:backdrop-blur-sm bg-neutral-900 text-neutral-100 rounded-2xl p-0 max-w-lg w-full shadow-2xl border border-neutral-800 open:animate-in open:fade-in-0 open:zoom-in-95">
  <form method="dialog" class="flex flex-col max-h-[85vh]">
    <!-- Header -->
    <header class="p-6 border-b border-neutral-800 flex justify-between items-center">
      <h3 class="text-xl font-bold">Personalizar Hamburguesa Clásica</h3>
      <button value="cancel" class="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-400">✕</button>
    </header>

    <!-- Scrollable Modifier Groups -->
    <div class="p-6 overflow-y-auto space-y-6">
      <!-- Modifier Group: Required Single Choice -->
      <fieldset class="space-y-3">
        <legend class="text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Término de la Carne <span class="text-red-400">*Obligatorio</span>
        </legend>
        <div class="grid grid-cols-1 gap-2">
          <label class="flex items-center justify-between p-4 rounded-xl border border-neutral-800 bg-neutral-800/50 min-h-[48px] cursor-pointer">
            <span class="font-medium">Término Medio</span>
            <input type="radio" name="group_term" value="mod_1" required class="w-5 h-5 text-amber-500" />
          </label>
        </div>
      </fieldset>

      <!-- Modifier Group: Multi-Choice with Surcharges -->
      <fieldset class="space-y-3">
        <legend class="text-sm font-semibold uppercase tracking-wider text-neutral-400">
          Ingredientes Extra (Opcional)
        </legend>
        <div class="grid grid-cols-1 gap-2">
          <label class="flex items-center justify-between p-4 rounded-xl border border-neutral-800 bg-neutral-800/50 min-h-[48px] cursor-pointer">
            <span class="font-medium">Tocineta Crujiente (+ $4.500)</span>
            <input type="checkbox" name="group_extras" value="mod_2" class="w-5 h-5 rounded text-amber-500" />
          </label>
        </div>
      </fieldset>
    </div>

    <!-- Footer with Dynamic Price & Add Button -->
    <footer class="p-6 border-t border-neutral-800 bg-neutral-900/90 flex items-center justify-between">
      <div>
        <p class="text-xs text-neutral-400">Total Plato</p>
        <p class="text-2xl font-bold text-amber-400">$32.500</p>
      </div>
      <button type="submit" value="confirm" class="min-h-[48px] px-8 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl flex items-center gap-2">
        Agregar al Pedido
      </button>
    </footer>
  </form>
</dialog>
```

#### Light-Dismiss Script Spec
```typescript
const dialog = document.getElementById('modifier-dialog') as HTMLDialogElement;

// Open modal
export function openModifierModal(item: MenuItem) {
  dialog.showModal();
}

// Light dismiss: Close on backdrop click
dialog.addEventListener('click', (event) => {
  const rect = dialog.getBoundingClientRect();
  const isInDialog = (
    rect.top <= event.clientY &&
    event.clientY <= rect.top + rect.height &&
    rect.left <= event.clientX &&
    event.clientX <= rect.left + rect.width
  );
  if (!isInDialog) {
    dialog.close('cancel');
  }
});
```

### 4.3 Persistent Cart & Idempotency Specification
- **Storage Strategy**: Cart items stored in `localStorage` with key `restaurant_cart_mesa_${tableId}`.
- **Cart Item Composite Key**:
  `line_item_id = `${item_id}:${selected_modifier_ids.sort().join(',')}`;`
- **Idempotency Key Protocol**:
  1. An `idempotency_key` is generated via `crypto.randomUUID()` when a checkout session begins or upon first clicking "Confirmar Pedido".
  2. The key is stored in memory alongside the in-flight order status.
  3. If the network request fails with a network error (`FetchError`, `TypeError`, or timeout), the retry mechanism keeps the **exact same** `idempotency_key`.
  4. Once an order receives HTTP 201 Created from the backend, the cart for that table is cleared from `localStorage`, and the order ID is saved to `active_orders_mesa_${tableId}` to begin live tracking.

---

## 5. Deep Dive: Vista Cocina / KDS (`/cocina`) Specification

### 5.1 Route & Architecture
- **URL Pattern**: `/cocina`
- **Display Target**: Kitchen tablets (iPad 10.2", Samsung Galaxy Tab A8, or 21" touch monitors).
- **Theme**: Dark Mode First (`bg-black text-neutral-100`) to maximize contrast, prevent glare from kitchen lights, and minimize OLED battery drain.
- **Columns (Lanes)**:
  1. **Nuevas / Pendientes (`PENDING`)**: High priority alerts, waiting for cook acknowledgment.
  2. **En Preparación (`IN_PREP`)**: Active on stoves/grills, elapsed timer running.
  3. **Listas para Entrega (`READY`)**: Plated dishes waiting for runner/waitstaff pickup.
  4. **Entregadas / Historial (`SERVED`)**: Closed orders, minimized view.

### 5.2 Screen Wake Lock API Specification
In a commercial kitchen, cooks cannot touch the screen with greasy or wet hands just to prevent the tablet from dimming or sleeping.
- **Specification**:
```typescript
class KitchenWakeLock {
  private sentinel: WakeLockSentinel | null = null;
  private isActive: boolean = false;

  async request(): Promise<boolean> {
    if (!('wakeLock' in navigator)) {
      console.warn('Screen Wake Lock API not supported on this browser.');
      return false;
    }
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
      this.isActive = true;
      this.sentinel.addEventListener('release', () => {
        this.isActive = false;
      });
      return true;
    } catch (err) {
      console.error('Failed to acquire screen wake lock:', err);
      return false;
    }
  }

  setupVisibilityListener() {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && !this.isActive) {
        await this.request();
      }
    });
  }

  async release() {
    if (this.sentinel) {
      await this.sentinel.release();
      this.sentinel = null;
      this.isActive = false;
    }
  }
}
```

### 5.3 Web Audio API Zero-Dependency Synthesizer
Per `kds-engineer.md`, the kitchen sound must not depend on audio files (MP3/WAV) which could fail to load over flaky Wi-Fi.

#### Tone Synthesizer Implementation
```typescript
class KitchenAudioAlert {
  private ctx: AudioContext | null = null;
  private isUnlocked: boolean = false;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  async unlock(): Promise<boolean> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    this.isUnlocked = ctx.state === 'running';
    return this.isUnlocked;
  }

  // Synthesizes a crisp, restaurant-grade two-tone chime (D5 -> A5)
  playOrderNotification() {
    const ctx = this.getContext();
    if (ctx.state !== 'running') return;

    const now = ctx.currentTime;

    // Tone 1: Note D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: Note A5 (880.00 Hz) - slightly higher, rings out
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle'; // Gives a richer bell-like harmonic
    osc2.frequency.setValueAtTime(880.00, now + 0.15);
    gain2.gain.setValueAtTime(0.4, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.7);
  }
}
```

### 5.4 Preparation Time Semáforo Spec
Each comanda card displays an elapsed time counter calculated as `elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)` (minutes).
- **Tier 1 (Normal)**: `elapsed < 10` minutes  
  `Badge: bg-emerald-950 text-emerald-400 border border-emerald-800`
- **Tier 2 (Attention)**: `10 <= elapsed < 20` minutes  
  `Badge: bg-amber-950 text-amber-400 border border-amber-800`
- **Tier 3 (Urgent / Delayed)**: `elapsed >= 20` minutes  
  `Badge: bg-red-950 text-red-400 border border-red-700 animate-pulse font-bold`

### 5.5 View Transitions API for Kanban Card Movements
When cooks tap "Iniciar Preparación" or "Marcar Listo", the card moves to another lane.
```typescript
export function transitionOrderState(orderId: string, nextState: OrderStatus, updateCallback: () => void) {
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    (document as any).startViewTransition(() => {
      updateCallback();
    });
  } else {
    updateCallback();
  }
}
```

---

## 6. Deep Dive: Vista Caja (`/caja`) Specification

### 6.1 Route & Overview
- **URL Pattern**: `/caja`
- **Target User**: Cashier / Manager using POS terminal or iPad.
- **Key Capabilities**:
  1. **Floorplan / Table Matrix**: 12 to 24 table cards displaying active bill amount, customer seated duration, and comanda status.
  2. **Consolidated Account Breakdown**: Clicking a table aggregates all individual orders submitted by that table during the session.
  3. **Tip & Tax Calculation**:
     - Subtotal of all delivered/active items.
     - Impuesto al Consumo (8%) or IVA (19%) configurable per item or subtotal.
     - Voluntary Tip (Propina sugerida 10% standard in Colombia).
  4. **Multi-Payment Settlement**:
     - Cash (calculates exact change from tendered money).
     - Credit / Debit Card (records transaction reference).
     - Digital Transfer (Nequi / Daviplata reference).
  5. **Table Closure Action**: Emits event/POST request updating table state to `AVAILABLE`, marks orders as `PAID`, and triggers bill printing/generation.

---

## 7. Frontend Architecture, Components & Design System

### 7.1 Next.js App Router Structure
```
app/
├── layout.tsx                # Global HTML, Inter font, viewport & wake-lock root
├── page.tsx                  # Landing / Route selector (/mesa, /cocina, /caja)
├── mesa/
│   └── [id]/
│       ├── page.tsx          # Tablet client entry point
│       ├── layout.tsx        # Tablet full-screen layout
│       └── components/
│           ├── MenuCatalog.tsx
│           ├── ProductCard.tsx
│           ├── ModifierModal.tsx (Native <dialog>)
│           ├── CartDrawer.tsx
│           ├── QuantityStepper.tsx
│           └── OrderTracker.tsx
├── cocina/
│   ├── page.tsx              # KDS screen entry point
│   ├── layout.tsx            # High contrast dark layout
│   └── components/
│       ├── KanbanBoard.tsx
│       ├── KanbanColumn.tsx
│       ├── ComandaCard.tsx
│       ├── SemaphoroBadge.tsx
│       ├── AudioUnlockBanner.tsx
│       └── WakeLockIndicator.tsx
└── caja/
    ├── page.tsx              # Cashier oversight entry point
    └── components/
        ├── TableGrid.tsx
        ├── TableCard.tsx
        ├── OrderSummaryBill.tsx
        ├── TipCalculator.tsx
        └── PaymentModal.tsx
```

### 7.2 Touch Ergonomics & Tailwind Design Tokens
- **Minimum Tap Size**: All buttons, inputs, pills, and cards have classes `min-h-[48px] min-w-[48px]` and padding >= 12px.
- **Viewport meta tag**:
  `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />`
- **Touch action**: `touch-action: manipulation` on all interactive buttons to eliminate mobile browser 300ms click delay.

---

## 8. Data Contracts for Frontend Integration

### 8.1 Menu Item with Relational Modifier Groups
```typescript
export interface Modifier {
  id: string;
  name: string;
  price_delta: number; // e.g. 3500 for +$3.500 COP
}

export interface ModifierGroup {
  id: string;
  name: string; // e.g. "Término de la carne", "Salsas"
  min_selection: number; // 1 for required, 0 for optional
  max_selection: number; // 1 for radio, >1 for checkboxes
  modifiers: Modifier[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category_id: string;
  base_price: number;
  image_url?: string;
  modifier_groups: ModifierGroup[];
}
```

### 8.2 Order Submission Payload (Frontend -> Backend)
```typescript
export interface OrderItemSubmission {
  menu_item_id: string;
  quantity: number;
  modifier_ids: string[]; // Strict relational IDs, no free text
}

export interface CreateOrderPayload {
  table_id: string;
  idempotency_key: string; // UUID v4 generated on client
  items: OrderItemSubmission[];
}
```

### 8.3 KDS Comanda Realtime Event Contract
```typescript
export type OrderStatus = 'PENDING' | 'IN_PREP' | 'READY' | 'SERVED' | 'CANCELLED';

export interface ComandaTicket {
  order_id: string;
  idempotency_key: string;
  table_id: string;
  table_number: number;
  status: OrderStatus;
  created_at: string; // ISO 8601 string
  items: {
    order_item_id: string;
    item_name: string;
    quantity: number;
    modifiers: {
      modifier_id: string;
      name: string;
      price_delta: number;
    }[];
  }[];
}
```

---

## 9. Conclusion & Implementation Readiness

The frontend requirements for R1 are exhaustively mapped:
- **Tablet UI (`/mesa/[id]`)**: Fully specifies native `<dialog>` modal pattern, minimum 48px touch targets, local persistence, and client UUID idempotency.
- **KDS (`/cocina`)**: Fully specifies the real-time Kanban architecture, zero-dependency Web Audio API synthesizer, 3-tier time semáforo, Screen Wake Lock API lifecycle, and View Transitions API.
- **Cashier (`/caja`)**: Fully specifies the table overview matrix, order aggregation, tax/tip calculations, and table settlement.
- **Zero Heavy UI Bloat**: Compliance with modern web standards and `.agents/roles` directives ensures a rapid, resilient, and maintainable implementation.
