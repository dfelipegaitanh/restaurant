# Project: Restaurant Real-Time Ordering & KDS Prototype

## Architecture
The system is a unified Next.js (TypeScript + Tailwind CSS) restaurant management web application with reactive real-time state synchronization, running on Node.js 22 LTS:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js Unified Frontend                        │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ Customer Tablet    │ Kitchen Display    │ Cashier / Billing            │
│ /mesa/[id]         │ /cocina            │ /caja                        │
│ - Menu Catalog     │ - Realtime Kanban  │ - Table Oversight            │
│ - Native <dialog>  │ - Web Audio Chime  │ - Session Item Aggregation   │
│ - Local Cart       │ - Screen Wake Lock │ - Subtotal/Tax/Tip           │
│ - Client UUID v4   │ - Preparation      │ - Payment & Settlement       │
│   idempotency_key  │   Timer Semáforo   │ - Table Release              │
└─────────┬──────────┴─────────▲──────────┴──────────────▲───────────────┘
          │ POST /api/orders   │ SSE Stream              │ SSE Stream
          │                    │ /api/realtime           │ /api/realtime
┌─────────▼────────────────────┴─────────────────────────┴───────────────┐
│                        Next.js App Router Backend                      │
├────────────────────────────────────────────────────────────────────────┤
│ - EventHub / Realtime Broadcaster (SSE)                                │
│ - Order Creation Controller (Atomic Idempotency Verification)          │
│ - Kitchen Order Status Controller (Kanban State Transitions)           │
│ - Billing & Settlement Controller                                      │
├────────────────────────────────────────────────────────────────────────┤
│                        Data Layer & Engine                             │
│ Dual-Mode PostgreSQL:                                                  │
│ 1. WASM Embedded PostgreSQL 16 (@electric-sql/pglite)                  │
│    -> Zero external daemons, self-contained automated testing & local  │
│ 2. Standard PostgreSQL via `pg` pool when `DATABASE_URL` is set        │
│                                                                        │
│ Relational DDL with First-Class Modifiers:                             │
│ tables, products, modifier_groups, modifiers, product_modifier_groups, │
│ orders (idempotency_key UNIQUE), order_items, order_item_modifiers,   │
│ payments, table_sessions                                               │
└────────────────────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Relational Schema & DDL | PostgreSQL tables with first-class relational modifiers (no free-text notes) | M1 | survey_miner_db |
| 2 | Dual-Mode Database Engine | WASM Postgres 16 (PGlite) + standard PostgreSQL via DATABASE_URL | M1 | survey_miner_db, survey_explorer_infra |
| 3 | Database Seed Data | 8 restaurant tables, categorized menu products, and modifier groups | M1 | survey_miner_db |
| 4 | Atomic Idempotency Constraint | `orders(idempotency_key UUID UNIQUE)` with conflict detection & graceful replay | M1 | survey_miner_db, ORIGINAL_REQUEST |
| 5 | Shared TypeScript Contracts | Centralized types for domain entities, DTOs, and RealtimeEvent unions | M1 | survey_miner_db, survey_miner_ui |
| 6 | Menu & Tables API | `GET /api/menu` and `GET /api/tables` returning catalog with relational modifiers | M1 | survey_miner_db |
| 7 | Order Ingestion API | `POST /api/orders` inserting orders and item modifiers in single transaction | M1 | survey_miner_db |
| 8 | Real-Time SSE Broadcaster | `/api/realtime` Server-Sent Events endpoint streaming order lifecycle events | M1 | survey_miner_db, survey_miner_ui |
| 9 | Tablet Menu Catalog | Responsive touch catalog on `/mesa/[id]` grouped by categories | M2 | survey_miner_ui |
| 10 | Native `<dialog>` Customizer | Dish personalization modal using HTML5 `<dialog>`, `.showModal()`, light dismiss | M2 | survey_miner_ui, ORIGINAL_REQUEST |
| 11 | Relational Modifier Selection | Selection of mandatory/optional modifiers (action_type: NO, EXTRA, OPTION) | M2 | survey_miner_ui, ORIGINAL_REQUEST |
| 12 | Persistent Tablet Cart | Client-side shopping cart persisted in `localStorage` per table session | M2 | survey_miner_ui |
| 13 | Client UUID Idempotency Key | `crypto.randomUUID()` generated per order submission | M2 | survey_miner_ui, ORIGINAL_REQUEST |
| 14 | Rapid-Click / Double-Submit Guard | Immediate button lock and optimistic feedback during order dispatch | M2 | survey_miner_ui |
| 15 | KDS Real-Time Kanban Board | `/cocina` Kanban lanes: PENDING, IN_PREP, READY, SERVED | M3 | survey_miner_ui, ORIGINAL_REQUEST |
| 16 | Synthetic Web Audio Chime | Dual-tone audio chime (D5 -> A5) using Web Audio API (zero external MP3 files) | M3 | survey_miner_ui, ORIGINAL_REQUEST |
| 17 | Audio Unlock Gesture Banner | User interaction banner to activate AudioContext adhering to browser autoplay | M3 | survey_miner_ui |
| 18 | Screen Wake Lock API | Keep screen awake on `/cocina` with auto re-acquisition on `visibilitychange` | M3 | survey_miner_ui, ORIGINAL_REQUEST |
| 19 | Preparation Timer Semáforo | Color-coded badges based on elapsed time: Green (<10m), Orange (10-20m), Red (>20m) | M3 | survey_miner_ui |
| 20 | Order Status Transition API | `PATCH /api/orders/[id]/status` advancing kitchen ticket states | M3 | survey_miner_ui, survey_miner_db |
| 21 | Cashier Table Oversight | `/caja` dashboard showing all table statuses (FREE, OCCUPIED, BILL_REQUESTED) | M4 | survey_miner_ui, ORIGINAL_REQUEST |
| 22 | Table Bill Aggregation | Aggregate all orders placed for a table session into unified bill | M4 | survey_miner_ui |
| 23 | Tax, Tip & Total Calculations | Breakdown of subtotal, configurable tax (10%), tip options, and grand total | M4 | survey_miner_ui |
| 24 | Payment Processing API | `POST /api/tables/[id]/pay` recording payment (Cash, Card, Transfer) | M4 | survey_miner_ui, survey_miner_db |
| 25 | Table Settlement & Release API | `POST /api/tables/[id]/close` archiving session and freeing table | M4 | survey_miner_ui |
| 26 | Automated Full-Flow E2E Suite | Script verifying order with modifiers -> KDS ticket -> cashier settlement (code 0) | M5 | survey_explorer_infra, ORIGINAL_REQUEST |
| 27 | Concurrent Idempotency Burst Test | 5 concurrent requests with identical UUID asserting exactly 1 comanda created | M5 | survey_explorer_infra, ORIGINAL_REQUEST |
| 28 | Adversarial Coverage Hardening | White-box stress testing, network cuts, modifier constraint validation | M5 | survey_explorer_infra |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Backend & Relational DB | Next.js baseline, TypeScript types, Relational schema, PGlite/PG client, APIs (`/api/menu`, `/api/orders`, `/api/tables`, `/api/realtime`), seed data | none | DONE |
| M2 | Customer Tablet UI (`/mesa/[id]`) | Menu catalog, native `<dialog>` modifier modal, localStorage cart, client UUID v4, submit protection | M1 | DONE |
| M3 | Kitchen Display System (`/cocina`) | Real-time Kanban board, SSE stream consumer, Web Audio chime, Screen Wake Lock, preparation semáforo, status transitions | M1 | DONE |
| M4 | Cashier & Table Management (`/caja`) | Table grid, session order aggregation, bill calculations, payment processing, table release | M1 | DONE |
| M5 | Final Milestone: E2E Verification & Adversarial Hardening | Phase 1: 100% pass of E2E suite (Tiers 1-4) published by E2E Testing Track; Phase 2: Adversarial hardening (Tier 5) | M1, M2, M3, M4 | DONE |

## Interface Contracts

### 1. Database Schema Contracts (`types/domain.ts`)
```typescript
export type OrderStatus = 'PENDING' | 'IN_PREP' | 'READY' | 'SERVED' | 'CANCELLED';
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'CLOSED';
export type ModifierAction = 'NO' | 'EXTRA' | 'OPTION' | 'SUBSTITUTE';

export interface Modifier {
  id: string;
  group_id: string;
  name: string;
  action_type: ModifierAction;
  price_delta: number; // in cents
}

export interface ModifierGroup {
  id: string;
  name: string;
  min_selection: number;
  max_selection: number;
  modifiers: Modifier[];
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number; // in cents
  image_url?: string;
  description?: string;
  modifier_groups: ModifierGroup[];
}

export interface OrderItemModifierInput {
  modifier_id: string;
}

export interface OrderItemInput {
  product_id: string;
  quantity: number;
  modifiers: OrderItemModifierInput[];
}

export interface CreateOrderRequest {
  idempotency_key: string; // UUID v4
  table_id: string;
  items: OrderItemInput[];
}
```

### 2. Real-Time Events (`RealtimeEvent`)
```typescript
export type RealtimeEvent =
  | { type: 'ORDER_CREATED'; payload: { order: OrderSummary } }
  | { type: 'ORDER_STATUS_CHANGED'; payload: { order_id: string; table_id: string; old_status: OrderStatus; new_status: OrderStatus } }
  | { type: 'TABLE_STATUS_CHANGED'; payload: { table_id: string; status: TableStatus } }
  | { type: 'PAYMENT_COMPLETED'; payload: { table_id: string; bill_id: string; amount: number } };
```

### 3. API Endpoints
- `GET /api/menu`: Returns list of categories and products with nested `modifier_groups`.
- `GET /api/tables`: Returns list of tables with current status and active orders.
- `POST /api/orders`: Headers: `Content-Type: application/json`.
  - Body: `CreateOrderRequest`.
  - Success (201 Created): `{ success: true, order: OrderSummary, replayed: false }`.
  - Replay (200 OK): Header `X-Idempotent-Replay: true`, `{ success: true, order: OrderSummary, replayed: true }`.
  - Error (400 Bad Request): Invalid UUID, missing modifiers, violated min/max cardinalities.
- `PATCH /api/orders/[id]/status`: Body `{ status: OrderStatus }`.
- `GET /api/realtime`: SSE stream (`text/event-stream`). Emits `RealtimeEvent` JSON lines.
- `POST /api/tables/[id]/pay`: Body `{ payment_method: 'CASH' | 'CARD' | 'TRANSFER', tip_percentage?: number }`.
- `POST /api/tables/[id]/close`: Free table, archive session.

## Code Layout
```
/Users/felipegaitan/projects/restaurant/
├── .agents/                      # Agent metadata, specs & roles
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout with fonts & styles
│   ├── page.tsx                  # Landing / Navigation hub
│   ├── mesa/
│   │   └── [id]/
│   │       ├── page.tsx          # Tablet customer ordering view
│   │       ├── MenuCatalog.tsx   # Category & dish grid
│   │       ├── ModifierModal.tsx # Native <dialog> dish customizer
│   │       └── CartDrawer.tsx    # Persistent cart & checkout trigger
│   ├── cocina/
│   │   ├── page.tsx          # KDS Kanban board view
│   │   ├── KanbanLane.tsx    # Column renderer (Pending, Prep, Ready, Served)
│   │   ├── ComandaCard.tsx   # Ticket card with semáforo & modifiers list
│   │   ├── AudioBanner.tsx   # Unlock banner for Web Audio API
│   │   └── useAudioAlert.ts  # Web Audio synthetic tone synthesizer
│   ├── caja/
│   │   ├── page.tsx          # Cashier dashboard view
│   │   ├── TableGrid.tsx     # Table session oversight
│   │   └── BillModal.tsx     # Order aggregation & payment modal
│   └── api/
│       ├── menu/route.ts     # Menu catalog endpoint
│       ├── tables/route.ts   # Tables endpoint
│       ├── orders/
│       │   ├── route.ts      # Order creation (idempotency enforcement)
│       │   └── [id]/
│       │       └── status/route.ts # Kitchen status updates
│       ├── realtime/route.ts # SSE endpoint (/api/realtime)
│       └── billing/
│           ├── [tableId]/route.ts  # Table bill aggregation
│           └── pay/route.ts        # Payment processing & closure
├── lib/
│   ├── db/
│   │   ├── index.ts          # Database adapter (PGlite WASM / node-postgres)
│   │   ├── schema.sql        # PostgreSQL 16 DDL migration script
│   │   ├── seed.sql          # Initial restaurant seed data
│   │   └── queries.ts        # Type-safe database queries
│   ├── events/
│   │   └── eventHub.ts       # SSE event emitter / broadcaster singleton
│   └── utils/
│       ├── idempotency.ts    # UUID v4 validation & replay helpers
│       ├── audio.ts          # Web Audio tone synthesis generator
│       └── wakeLock.ts       # Screen Wake Lock manager
├── types/
│   ├── domain.ts             # Entities, database rows, DTOs
│   └── events.ts             # Realtime event discriminated unions
├── tests/
│   ├── e2e/
│   │   ├── full-flow.test.ts # End-to-end flow test (Table -> Kitchen -> Cashier)
│   │   └── resiliency.test.ts# Disconnect & recovery test
│   └── integration/
│       └── idempotency.test.ts # 5-click concurrent burst test
├── scripts/
│   ├── verify-e2e.ts         # Standalone E2E verification script (exits 0)
│   └── seed-db.ts            # Standalone seed executor
├── public/                   # Static assets
├── package.json              # Dependencies and test scripts
└── tsconfig.json             # TypeScript configuration
```
