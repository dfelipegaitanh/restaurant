## 2026-11-06T20:47:16Z
You are teamwork_worker implementing Milestone 1 (M1: Core Backend & Relational DB) for the Restaurant Web App.
Working directory: /Users/felipegaitan/projects/restaurant/.agents/teamwork/m1_worker_1/

MANDATORY INPUTS:
- Read /Users/felipegaitan/projects/restaurant/.agents/teamwork/ORIGINAL_REQUEST.md first (verbatim user requirements).
- Read /Users/felipegaitan/projects/restaurant/.agents/teamwork/PROJECT.md (architecture, milestones, interfaces, code layout).
- Read the 3 Explorer reports with complete implementation designs:
  1. /Users/felipegaitan/projects/restaurant/.agents/teamwork/m1_explorer_1/report.md (Database Engine, DDL schema, PGlite/PG client, seed data)
  2. /Users/felipegaitan/projects/restaurant/.agents/teamwork/m1_explorer_2/report.md (Idempotency, API route handlers, domain contracts)
  3. /Users/felipegaitan/projects/restaurant/.agents/teamwork/m1_explorer_3/report.md (Realtime EventHub singleton, SSE route handler)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

WRITE OWNERSHIP:
You own exclusively:
- /Users/felipegaitan/projects/restaurant/package.json
- /Users/felipegaitan/projects/restaurant/tsconfig.json
- /Users/felipegaitan/projects/restaurant/lib/db/ (schema.sql, seed.sql, index.ts, queries.ts)
- /Users/felipegaitan/projects/restaurant/lib/events/ (eventHub.ts)
- /Users/felipegaitan/projects/restaurant/types/ (domain.ts, events.ts)
- /Users/felipegaitan/projects/restaurant/app/api/ (menu/route.ts, tables/route.ts, orders/route.ts, orders/[id]/status/route.ts, realtime/route.ts)
- /Users/felipegaitan/projects/restaurant/app/layout.tsx, /Users/felipegaitan/projects/restaurant/app/page.tsx
- /Users/felipegaitan/projects/restaurant/scripts/seed-db.ts
DO NOT modify files in tests/ or TEST_INFRA.md or TEST_READY.md (owned by e2e_test_writer).

OBJECTIVE:
1. Initialize project files:
   - package.json with dependencies: next, react, react-dom, @electric-sql/pglite, pg, and devDependencies: typescript, @types/node, @types/react, tailwindcss, postcss, autoprefixer.
   - Run `npm install` (with BypassSandbox: true if network is needed for npm packages, or if npm error occurs, make sure clean installation completes).
   - tsconfig.json configured with strict TypeScript and paths alias (@/*).
2. Implement database layer in `lib/db/`:
   - `lib/db/schema.sql`: Full PostgreSQL 16 DDL with tables for `tables`, `table_sessions`, `categories`, `products`, `modifier_groups`, `modifiers`, `product_modifier_groups`, `orders(idempotency_key UUID UNIQUE)`, `order_items`, `order_item_modifiers`, `payments`.
   - `lib/db/seed.sql`: Seed data for 8 tables, categories, products, modifier groups (cardinalities min/max), modifiers.
   - `lib/db/index.ts`: Dual-mode DB client wrapper supporting `@electric-sql/pglite` and `pg.Pool`, with auto-initialization applying schema and seed on first boot.
   - `lib/db/queries.ts`: Query helper functions.
   - `scripts/seed-db.ts`: Standalone seed runner script.
3. Implement contracts in `types/domain.ts` and `types/events.ts`.
4. Implement `lib/events/eventHub.ts`: Singleton Node EventEmitter persisted on `globalThis.__restaurant_event_hub__`, 15-second keep-alive heartbeats, ring buffer, clean abort handling.
5. Implement route handlers:
   - `app/api/menu/route.ts`: Return hierarchical catalog with nested modifier groups and modifiers.
   - `app/api/tables/route.ts`: Return tables list with status and active orders.
   - `app/api/orders/route.ts`: Validate UUID `idempotency_key`, atomic database insertion with relational modifiers and server-side price calculation. On conflict, return HTTP 200 with `X-Idempotent-Replay: true` and suppress `eventHub.broadcast()`. On new order, return HTTP 201 and broadcast `ORDER_CREATED`.
   - `app/api/orders/[id]/status/route.ts`: Transition order status (`PENDING` -> `IN_PREP` -> `READY` -> `SERVED`), broadcast `ORDER_STATUS_CHANGED`.
   - `app/api/realtime/route.ts`: Server-Sent Events route handler streaming events to clients with keep-alive pings and abort listener.
6. Verify your implementation:
   - Run seed script (`node --experimental-strip-types scripts/seed-db.ts`).
   - Run a unit/integration test command to ensure DB queries and route handlers work and compile without error.
   - Document build and verification commands and results in your handoff report.

COMPLETION CRITERIA:
All files implemented and verified. Write handoff.md in your working directory and notify the orchestrator via send_message.
