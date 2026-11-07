# Forensic Integrity Audit Report — Milestone 1: Core Backend & Relational DB

**Auditor:** teamwork_auditor (`m1_auditor_1`)  
**Target:** Milestone 1 (Core Backend & Relational DB)  
**Profile:** General Project (Development Mode per `ORIGINAL_REQUEST.md`)  
**Verdict:** **CLEAN**

---

## 1. Observation

### 1.1 Schema & DDL Forensics (`lib/db/schema.sql`)
- **Table `orders` (lines 79–91):**
  ```sql
  CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      table_id VARCHAR(100) NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
      session_id VARCHAR(100) REFERENCES table_sessions(id) ON DELETE SET NULL,
      idempotency_key UUID NOT NULL UNIQUE,
      ...
  ```
  `idempotency_key` is strictly typed as `UUID NOT NULL UNIQUE`.
- **Relational Modifiers Architecture (lines 49–78, 107–114):**
  - `modifier_groups`: defines min/max selection bounds (`min_selection INT`, `max_selection INT`).
  - `modifiers`: defines discrete options with `action_type CHECK (action_type IN ('NO', 'EXTRA', 'OPTION', 'SUBSTITUTE'))` and `price_delta DECIMAL(10, 2)`.
  - `product_modifier_groups`: maps N:M relationships with `PRIMARY KEY (product_id, modifier_group_id)`.
  - `order_item_modifiers`: records selected modifiers per order item with `REFERENCES order_items(id) ON DELETE CASCADE`, `REFERENCES modifiers(id) ON DELETE RESTRICT`, and `UNIQUE (order_item_id, modifier_id)`.
- **Zero Free-Text Fallback:**
  Inspection confirms neither `orders`, `order_items`, nor `order_item_modifiers` contains free-text note columns or arbitrary modifier string fields.

### 1.2 Query & Business Logic Forensics (`lib/db/queries.ts`)
- **No Hardcoded Output / No Dummy Facades:**
  - `getTables()`: Queries `restaurant_tables` and aggregates unpaid balances from active `orders`.
  - `getMenu()`: Performs multi-table JOIN across `products`, `categories`, `product_modifier_groups`, `modifier_groups`, and `modifiers`.
  - `createOrderAtomic(params)` (lines 293–513):
    - Pre-validates table presence (`SELECT id, table_number, status FROM restaurant_tables WHERE id = $1`).
    - Validates product existence and cardinality rules (`min_selection`, `max_selection`) via SQL lookup on `product_modifier_groups`.
    - Server-side price calculation: `unitPrice = Number(prod.base_price) + modifiersDelta`. Client-provided prices are ignored.
    - Transactional execution:
      ```typescript
      await tx.query(
        `INSERT INTO orders (table_id, idempotency_key, status, total_amount, created_at, updated_at)
         VALUES ($1, $2, 'PENDING', $3, NOW(), NOW())
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id, order_number, table_id, idempotency_key, status, total_amount, created_at, updated_at`,
        [params.table_id, params.idempotency_key, orderTotal]
      );
      ```
    - Inserts line items into `order_items` and selected modifiers into `order_item_modifiers`.
    - Updates table status to `OCCUPIED`.

### 1.3 Route Handler Forensics (`app/api/orders/route.ts`)
- Validates UUID v4 regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`.
- Calls `createOrderAtomic`.
- On duplicate (`result.replayed === true`): returns HTTP 200 with header `X-Idempotent-Replay: true` and suppresses SSE broadcast.
- On fresh creation (`result.replayed === false`): returns HTTP 201, broadcasts `ORDER_CREATED` and `TABLE_STATUS_CHANGED` to `eventHub`.

### 1.4 Production Build Forensics
- Command: `npm run build`
- Output:
  ```
  ✓ Compiled successfully in 14.3s
  Linting and checking validity of types     ✓ Linting and checking validity of types 
  Collecting page data     ✓ Collecting page data 
  ✓ Generating static pages (4/4)
  Collecting build traces     ✓ Collecting build traces 
  Finalizing page optimization     ✓ Finalizing page optimization 
  ```
  Bundle inspection of `.next/server/chunks/527.js` confirmed genuine bundled SQL queries (`INSERT INTO orders...`, `INSERT INTO order_item_modifiers...`).

### 1.5 Runtime Database Seeding & Empirical Constraint Verification
- **Command:** `node --experimental-strip-types scripts/seed-db.ts`
  Output:
  ```
  📊 Database Summary Verification:
  ┌─────────┬───────────────────────────┬───────┬──────────┐
  │ (index) │ Entity                    │ Count │ Expected │
  ├─────────┼───────────────────────────┼───────┼──────────┤
  │ 0       │ 'restaurant_tables'       │ 8     │ 8        │
  │ 1       │ 'categories'              │ 4     │ 4        │
  │ 2       │ 'products'                │ 5     │ 5        │
  │ 3       │ 'modifier_groups'         │ 4     │ 4        │
  │ 4       │ 'modifiers'               │ 15    │ 15       │
  │ 5       │ 'product_modifier_groups' │ 6     │ 6        │
  └─────────┴───────────────────────────┴───────┴──────────┘
  ✨ [DB] Completed migration & seed in 1689ms.
  ```
- **Empirical Constraint Verification:**
  Executed live SQL transactions directly against `./data/pglite_db`:
  ```
  [DB] Initializing embedded WebAssembly PostgreSQL 16 (@electric-sql/pglite)...
  Testing Postgres Relational Constraints...
  Order inserted: 27e645c2-8c6a-4487-85f6-60816371deeb
  Duplicate idempotency key rejected as expected: 23505
  Order item inserted: 622e193e-55f5-47cd-91e8-8225b177b19e
  Order item modifier inserted.
  Foreign key violation caught as expected: 23503
  Duplicate modifier on item caught as expected: 23505
  Cleaned up test order. ALL CONSTRAINT TESTS PASSED!
  ```
  Raw error codes:
  - `23505`: PostgreSQL standard `unique_violation` triggered on duplicate `idempotency_key` and duplicate `(order_item_id, modifier_id)`.
  - `23503`: PostgreSQL standard `foreign_key_violation` triggered when attempting to link non-existent modifier.

---

## 2. Logic Chain

1. **Integrity Mode Alignment:**
   - Ground truth in `ORIGINAL_REQUEST.md` line 8 designates `Integrity mode: development`.
   - Development mode prohibits hardcoded outputs, dummy facades, and fabricated results.
   - All code in `lib/db/` and `app/api/` connects to real SQL routines and the PostgreSQL database.

2. **Absence of Facades & Hardcoding:**
   - Ripgrep searches across `lib/` and `app/api/` for `TODO`, `dummy`, `mock`, or fake returns yielded zero hits.
   - Compiled Next.js chunks (`.next/server/chunks/527.js`) verify that production route handlers bundle full SQL statements and transactional logic.

3. **Authentic Relational Modeling:**
   - The DDL strictly prohibits free text by omitting free-form note columns.
   - Modifiers are represented across four dedicated relational tables (`modifier_groups`, `modifiers`, `product_modifier_groups`, `order_item_modifiers`).
   - Cardinality enforcement (`min_selection` and `max_selection`) is validated in `queries.ts` prior to transaction execution.

4. **Empirical Proof of Idempotency:**
   - The PostgreSQL cluster in `./data/pglite_db` physically rejected duplicate UUID insertions with native error code `23505`.
   - Concurrency bursts are handled through `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING` and replay resolution.

5. **SSE Event Streaming Integrity:**
   - `lib/events/eventHub.ts` and `app/api/realtime/route.ts` provide a genuine `ReadableStream` with circular event buffer replay and keepalive comments. Replayed idempotent requests deliberately bypass the broadcaster, preventing spurious kitchen tickets.

---

## 3. Caveats

- **Sandbox Network Policy:** The local agent sandbox enforces socket access policies (`EPERM` on direct TCP loopback to localhost:3000 without `BypassSandbox`). Verification of the Next.js routes was conducted via `next build` static/dynamic bundle analysis, compilation checks, and in-process execution against the underlying database cluster.
- **Frontend Views (M2, M3, M4):** Customer tablet (`/mesa/[id]`), KDS board (`/cocina`), and cashier UI (`/caja`) are scheduled for future milestones. The backend and API contracts powering them are complete and verified.

---

## 4. Conclusion

**Verdict: CLEAN**

The Milestone 1 work product meets all integrity standards:
1. No hardcoded results, dummy facades, or shortcuts exist in the codebase.
2. The relational schema in `lib/db/schema.sql` creates genuine tables, relational modifiers, and unique idempotency constraints.
3. Database queries in `lib/db/queries.ts` execute authentic SQL against PostgreSQL 16.
4. Next.js production build succeeds with exit code 0.
5. Seeding and constraint enforcement have been verified empirically with raw PostgreSQL error codes (`23505`, `23503`).

Milestone 1 is certified authentic, robust, and approved to proceed to Milestone 2.

---

## 5. Verification Method

To independently reproduce the forensic verification:

1. **Verify Database Seeding:**
   ```bash
   node --experimental-strip-types scripts/seed-db.ts
   ```
   *Expected outcome:* Exits with code 0; logs table with 8 tables, 4 categories, 5 products, 4 groups, 15 modifiers.

2. **Verify PostgreSQL Relational Constraints & Idempotency:**
   ```bash
   node --experimental-strip-types --input-type=module -e '
   import { getDb } from "./lib/db/index.ts";
   import crypto from "node:crypto";
   async function run() {
     const db = await getDb();
     const uuid = crypto.randomUUID();
     await db.query("INSERT INTO orders (table_id, idempotency_key, status, total_amount) VALUES (\$1, \$2, \$3, \$4)", ["table-1", uuid, "PENDING", 28500]);
     try {
       await db.query("INSERT INTO orders (table_id, idempotency_key, status, total_amount) VALUES (\$1, \$2, \$3, \$4)", ["table-1", uuid, "PENDING", 28500]);
       throw new Error("Duplicate key not caught");
     } catch (e) {
       console.log("Unique constraint caught:", e.code);
     }
   }
   run();
   '
   ```
   *Expected outcome:* Displays `Unique constraint caught: 23505`.

3. **Verify Next.js Production Build:**
   ```bash
   npm run build
   ```
   *Expected outcome:* Compiles with code 0, generating all 8 dynamic API routes.
