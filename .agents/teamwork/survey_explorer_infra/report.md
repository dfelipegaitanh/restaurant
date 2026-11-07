# Workspace Infrastructure, Tooling & Reliability Testing Specification

**Author:** teamwork_explorer (`survey_explorer_infra`)  
**Date:** 2026-11-06T20:37:00Z  
**Project:** Unified Next.js Restaurant POS & KDS Web App  
**Status:** Approved Workspace & Reliability Baseline Report  
**Authoritative References:** `.agents/teamwork/ORIGINAL_REQUEST.md`, `.agents/roles/reliability-tester.md`, `.agents/roles/db-architect.md`, `.agents/roles/tablet-ui.md`, `.agents/roles/kds-engineer.md`.

---

## 1. Executive Summary & Authoritative Sources

This report provides the authoritative architectural survey of the workspace environment, runtime tooling, network/container capabilities, and the automated testing harness required to validate the restaurant ordering, KDS, and cashier platform under strict reliability constraints.

### Authoritative Specification Sources
1. **`ORIGINAL_REQUEST.md`**: Greenfield Next.js (TypeScript + Tailwind CSS) app across three views (`/mesa/[id]`, `/cocina`, `/caja`), PostgreSQL backend with real-time sync, mandatory idempotency (`idempotency_key UK`), and automated verification script ending with exit code 0.
2. **`.agents/roles/reliability-tester.md`**: Operational requirements:
   - Burst double-click simulation (5 rapid clicks on "Confirmar Pedido" resulting in exactly 1 comanda).
   - Relational modifier integrity under complex combinations without price distortion or note dropping.
   - Resiliency testing under Wi-Fi disconnections, mid-flight retries, and reconnects.
3. **Host Runtime Audit**: Direct system commands verifying Node.js, npm, Docker, and port availability on macOS Darwin x86_64.

---

## 2. Workspace Baseline & Runtime Environment Audit

### 2.1 File System Baseline
- **Path**: `/Users/felipegaitan/projects/restaurant`
- **Current State**: Greenfield repository.
  - The root directory contains **no files** except `.agents/`.
  - **No `package.json`**, **no `tsconfig.json`**, **no `docker-compose.yml`**, **no `.env`**.
  - **Git status**: Git is installed (`git version 2.50.1`), but `.git` is **not yet initialized** (`git init` required during project bootstrap).

### 2.2 Host Runtime & Tooling Audit
| Tool / Runtime | Installed Version | Location / Source | Status & Recommendation |
|---|---|---|---|
| **Node.js** | `v22.11.0` (LTS) | `/Users/felipegaitan/.nvm/versions/node/v22.11.0/bin/node` | **Ready**. Modern Node 22 with native WebSocket, fetch, crypto, and test runner. |
| **npm** | `10.9.0` | `/Users/felipegaitan/.nvm/versions/node/v22.11.0/bin/npm` | **Ready**. Primary package manager for all installations. |
| **pnpm** | *Not Installed* | Command not found | Do not use in project scripts. |
| **yarn** | `1.22.22` | `/usr/local/Cellar/yarn/1.22.22` | **Restricted**: Throws sandbox EPERM when reading `~/.yarnrc`. Do not use. |
| **bun** | *Not Installed* | Command not found | Do not use. |
| **Docker Engine** | *Not Installed* | Not in PATH, no `/Applications/Docker.app` | **CRITICAL FACTOR**: Docker is not available in this environment. |
| **PostgreSQL** | *Not Installed* | `psql` / `postgres` not found in Homebrew | **CRITICAL FACTOR**: No native local PostgreSQL daemon. |
| **Architecture** | `Darwin x86_64` | macOS | 64-bit POSIX environment. |

### 2.3 Port Availability Audit
- **Port 3000** (Default Next.js Dev Server): **FREE** (No active process listening).
- **Port 5432** (Standard PostgreSQL port): **FREE** (No active process listening).
- **Port 8080** (Alternative API / WebSocket port): **FREE** (No active process listening).

### 2.4 Critical Environment Finding: PostgreSQL Strategy Without Docker
Because Docker is not installed and no native PostgreSQL service exists on this machine, relying exclusively on `docker-compose up` would fatally stall development.

**Architectural Resolution:**
The project must adopt a **Dual-Mode Database Adapter Strategy**:
1. **Development & Self-Contained Test Mode (Zero Daemon / Zero Docker)**:
   - Use **`@electric-sql/pglite`** (PostgreSQL 16 compiled to WebAssembly that runs natively in Node.js 22).
   - `@electric-sql/pglite` supports full relational SQL, UUIDs, foreign keys, CHECK constraints, unique constraints, and ACID transactions directly in memory or backed by a local directory (`./data/pglite_db`).
   - Requires **no Docker**, **no Homebrew installation**, and runs seamlessly in local tests and sandbox environments.
2. **Production / External PostgreSQL Mode**:
   - Standard PostgreSQL connection via `pg` or `postgres.js` pool using `DATABASE_URL` (compatible with Supabase or managed Cloud SQL).
3. **Unified Interface**:
   - Both modes share the exact same SQL schema (`001_initial_schema.sql`) and contract types (`@/types/database.ts`).

### 2.5 Node.js 22 Built-In Superpowers
Node.js `v22.11.0` includes native capabilities that eliminate heavy external dependencies:
1. **`node:test` & `node:assert`**: Built-in test runner supporting `describe`, `it`, `before`, `after`, async suites, and subtests with TAP/spec formatting. No need for Vitest or Jest.
2. **`node --experimental-strip-types`**: Native execution of `.ts` files directly in Node without needing `ts-node` or preliminary compilation.
3. **`node:crypto` (`randomUUID()`)**: Cryptographically secure UUID v4 generation for `idempotency_key`.
4. **`globalThis.fetch` & `globalThis.WebSocket`**: Native HTTP client and WebSocket support in Node 22 for E2E harnesses.

---

## 3. Reliability & Automated Testing Specification (`reliability-tester.md`)

The testing architecture must validate the three non-negotiable operational requirements from `.agents/roles/reliability-tester.md` and the acceptance criteria from `ORIGINAL_REQUEST.md`.

### 3.1 Overview of Test Suites
```
tests/
├── integration/
│   ├── db-schema.test.ts        # Relational constraints, modifiers, foreign keys
│   └── idempotency.test.ts      # Concurrency bursts & duplicate rejection
├── e2e/
│   ├── full-flow.test.ts        # Table -> Kitchen KDS -> Cashier full flow
│   └── resiliency.test.ts       # Network dropouts, retries & out-of-order events
scripts/
└── verify-e2e.ts                # Standalone automated verification runner (exits 0)
```

---

## 4. Test Suite 1: Full Flow Verification (`full-flow.test.ts` & `verify-e2e.ts`)

### 4.1 Objective & Criteria
Execute an end-to-end integration flow across all three application layers (Customer Tablet, Kitchen KDS, Cashier) programmatically and terminate with process exit code `0`.

### 4.2 Step-by-Step Test Execution Flow

```
[Customer Tablet]              [Backend / SSE Hub]                 [Kitchen KDS]           [Cashier POS]
       |                                |                                |                       |
 1. Connect SSE ----------------------->|                                |                       |
       |                                |<--- 2. Connect KDS SSE --------|                       |
 3. POST /api/orders (UUID key) ------->|                                |                       |
       |                                |-- 4. Emit ORDER_CREATED ------>| (Web Audio + Ticket)  |
       |<-- 5. HTTP 201 Created --------|                                |                       |
       |                                |<-- 6. PATCH /orders/:id/status | (Cook starts prep)    |
       |                                |-- 7. Emit STATUS: IN_PREP ---->|                       |
       |                                |<-- 8. PATCH /orders/:id/status | (Cook marks ready)    |
       |                                |-- 9. Emit STATUS: READY ------>|                       |
       |                                |                                |                       |
       |                                |<---------------------------------- 10. GET /api/caja --|
       |                                |----------------------------------> 11. Return Bill ---|
       |                                |<---------------------------------- 12. POST /pay -----|
       |                                |----------------------------------> 13. Close & Paid --|
```

### 4.3 Detailed Assertion Checklist
1. **Phase 1: Table Order Creation with Modifiers**:
   - Table #3 selects "Hamburguesa Clásica Bogotana" ($24.000).
   - Customer adds required modifier: "Término Medio" ($0 delta).
   - Customer adds optional modifier: "Extra Tocineta Ahumada" (+$4.500 delta).
   - Generates client UUID `idempotency_key = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"`.
   - Sends `POST /api/orders`.
   - **Assert**: Response status `201 Created`.
   - **Assert**: Response payload contains `order_id` (UUID), `status === 'PENDING'`, and `total_amount === 28500.00`.
   - **Assert**: Database records 1 order, 1 order item, and 2 relational modifiers linked to `order_item_modifiers`.
2. **Phase 2: Kitchen Real-Time Verification**:
   - KDS client is connected to `/api/realtime` (SSE stream).
   - **Assert**: Event received with `type === 'ORDER_CREATED'`.
   - **Assert**: Payload ticket matches Table 3, order item shows "Hamburguesa Clásica Bogotana", modifier list contains "Término Medio" and "Extra Tocineta Ahumada".
   - KDS Chef updates status to `IN_PREP`: `PATCH /api/orders/${orderId}/status` with `{ status: 'IN_PREP' }`.
   - **Assert**: Status update succeeds with HTTP 200.
   - Chef marks order as `READY`: `PATCH /api/orders/${orderId}/status` with `{ status: 'READY' }`.
   - **Assert**: Real-time event `ORDER_STATUS_CHANGED` emitted with `status === 'READY'`.
3. **Phase 3: Cashier Settlement & Table Closure**:
   - Cashier queries bill for Table 3: `GET /api/tables/${tableId}/bill`.
   - **Assert**: Subtotal is $28.500.
   - **Assert**: Tax (8% Impoconsumo) is calculated as $2.280.
   - **Assert**: Voluntary 10% Tip is calculated as $2.850.
   - **Assert**: Total bill amount is $33.630.
   - Cashier executes payment: `POST /api/bills/${billId}/pay` with `{ payment_method: 'CASH', tendered_amount: 50000 }`.
   - **Assert**: Payment succeeds; `change_due === 16370.00`.
   - Cashier closes table: `POST /api/tables/${tableId}/close`.
   - **Assert**: Table status transitions to `AVAILABLE`. Orders marked `PAID`.
4. **Final Assertion**:
   - Entire test script finishes successfully, logs summary table, and exits with `process.exit(0)`.

---

## 5. Test Suite 2: Idempotency & Concurrency (`idempotency.test.ts`)

Per Rule 1 of `.agents/roles/reliability-tester.md`: *"Simular ráfagas de 5 clics rápidos en 'Confirmar Pedido' para verificar que solo se procese 1 comanda."*

### 5.1 Concurrency Burst Test Pattern
```typescript
test('Idempotency Burst: 5 concurrent submissions with identical idempotency_key create exactly 1 order', async () => {
  const tableId = await getTestTableId();
  const idempotencyKey = crypto.randomUUID();
  const payload = {
    table_id: tableId,
    idempotency_key: idempotencyKey,
    items: [
      {
        product_id: testBurgerId,
        quantity: 2,
        modifier_ids: [termModId, cheeseModId],
      },
    ],
  };

  // Simulate 5 simultaneous rapid clicks arriving in parallel within milliseconds
  const burstPromises = Array.from({ length: 5 }, () =>
    fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  );

  const responses = await Promise.all(burstPromises);
  const jsonResults = await Promise.all(responses.map((r) => r.json()));

  // 1. All responses must be successful (HTTP 200 or 201)
  responses.forEach((res) => {
    assert.ok(res.status === 200 || res.status === 201, `Status was ${res.status}`);
  });

  // 2. All responses must return the EXACT SAME order ID
  const orderIds = jsonResults.map((body) => body.data?.id || body.id);
  const uniqueOrderIds = new Set(orderIds);
  assert.strictEqual(uniqueOrderIds.size, 1, 'Burst produced multiple order IDs!');

  // 3. Database verification: Count orders with this idempotency_key
  const dbOrderCount = await countOrdersByIdempotencyKey(idempotencyKey);
  assert.strictEqual(dbOrderCount, 1, 'Database contains duplicate order records!');

  // 4. Database verification: Order items and modifiers must not be duplicated
  const itemsCount = await countOrderItems(orderIds[0]);
  assert.strictEqual(itemsCount, 1, 'Order items were duplicated!');
  
  const modifiersCount = await countOrderItemModifiers(orderIds[0]);
  assert.strictEqual(modifiersCount, 2, 'Modifiers were duplicated in database!');
});
```

### 5.2 Sequential Duplicate Retry Test
- After the order is completed, wait 500ms and send the identical payload again.
- **Assert**: Response is `HTTP 200 OK` with header `X-Idempotent-Replay: true` or response body flag `is_duplicate: true`.
- **Assert**: No new kitchen event is broadcast over SSE.

---

## 6. Test Suite 3: Resiliency & Edge Cases (`resiliency.test.ts`)

Per Rule 2 & 3 of `.agents/roles/reliability-tester.md`:

### 6.1 Modifier Integrity Under Complex Combinations
- Test multiple items with varying modifier configurations in the same order:
  - Item 1: Pizza Margarita with "Masa Delgada" (delta 0) + "Borde de Queso" (delta 5000).
  - Item 2: Pizza Margarita with "Masa Tradicional" (delta 0) - no cheese border.
- **Assert**:
  - Item 1 subtotal includes +$5.000.
  - Item 2 subtotal has base price only.
  - Modifiers are saved in relational table `order_item_modifiers` with FK references to `modifiers`.
  - Zero free-text fallback columns are populated.

### 6.2 Network Disconnect Simulation & Client Retry
- **Scenario**: Tablet client starts `fetch('/api/orders')`. An `AbortController` aborts the client socket 50ms into transmission (simulating flaky restaurant Wi-Fi drop).
- Tablet detects `AbortError` / network failure.
- Tablet re-sends the request using the cached `idempotency_key` stored in `localStorage`.
- **Assert**: Whether the server received the first attempt or only the second, exactly 1 order exists, and the client successfully receives the confirmed order.

### 6.3 State Machine Transition Guards
- Kitchen tries to set an order directly from `PENDING` to `SERVED` (skipping `IN_PREP` / `READY`) without valid override:
  - **Assert**: API returns HTTP 400 Bad Request ("Invalid state transition").
- Cashier tries to close a table with orders in `IN_PREP`:
  - **Assert**: API warns or requires explicit supervisor override flag.

---

## 7. Recommended Project Setup, Tooling & Scripts Configuration

### 7.1 Proposed `package.json`
```json
{
  "name": "restaurant-pos-kds",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "db:migrate": "node --experimental-strip-types scripts/migrate.ts",
    "db:seed": "node --experimental-strip-types scripts/seed.ts",
    "test": "node --experimental-strip-types --test tests/**/*.test.ts",
    "test:idempotency": "node --experimental-strip-types --test tests/integration/idempotency.test.ts",
    "test:e2e": "node --experimental-strip-types scripts/verify-e2e.ts"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@electric-sql/pglite": "^0.2.14",
    "pg": "^8.13.1"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^22.9.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/pg": "^8.11.10",
    "tailwindcss": "^3.4.14",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20"
  }
}
```

### 7.2 Directory Layout Recommendation
Following `PROJECT.md` standards:
```
restaurant/
├── app/
│   ├── api/
│   │   ├── orders/
│   │   │   ├── route.ts              # POST (create with idempotency), GET
│   │   │   └── [id]/
│   │   │       └── status/route.ts   # PATCH (transition KDS status)
│   │   ├── tables/
│   │   │   ├── route.ts              # GET all tables
│   │   │   └── [id]/
│   │   │       ├── bill/route.ts     # GET table aggregated bill
│   │   │       └── close/route.ts    # POST close & pay table
│   │   ├── realtime/
│   │   │   └── route.ts              # GET SSE stream for KDS & Tablet
│   │   └── menu/route.ts             # GET catalog with relational modifiers
│   ├── mesa/[id]/page.tsx            # Tablet UI
│   ├── cocina/page.tsx               # Kitchen KDS Board
│   ├── caja/page.tsx                 # Cashier Management
│   ├── layout.tsx
│   └── page.tsx                      # Navigation portal
├── lib/
│   ├── db/
│   │   ├── client.ts                 # Dual-mode (PGlite / standard pg) adapter
│   │   ├── schema.sql                # DDL PostgreSQL 16
│   │   └── seed.sql                  # Bogota restaurant menu seed
│   └── events/
│       └── eventHub.ts               # In-memory / PostgreSQL NOTIFY event hub
├── types/
│   ├── database.ts                   # Tables, modifiers, order types
│   └── api.ts                        # DTOs & Realtime SSE payloads
├── tests/
│   ├── integration/
│   │   ├── db-schema.test.ts
│   │   └── idempotency.test.ts
│   └── e2e/
│       ├── full-flow.test.ts
│       └── resiliency.test.ts
├── scripts/
│   ├── migrate.ts
│   ├── seed.ts
│   └── verify-e2e.ts                 # Acceptance criteria verification script (exit 0)
├── package.json
├── tsconfig.json
└── tailwind.config.js
```

---

## 8. Summary of Findings & Next Actionable Steps

1. **Workspace Greenfield**: The directory `/Users/felipegaitan/projects/restaurant` is pristine. Initialization starts from `git init` and `package.json` creation using standard `npm`.
2. **Docker Not Found**: Development must not block on Docker. `@electric-sql/pglite` enables 100% compliant PostgreSQL 16 execution natively in Node.js 22.
3. **Automated Verification Runner**: A standalone verification script (`scripts/verify-e2e.ts`) executed via `npm run test:e2e` will run the complete flow (Tablet -> KDS -> Cashier) and verify idempotency bursts, exiting with code 0 to fulfill acceptance criteria.
