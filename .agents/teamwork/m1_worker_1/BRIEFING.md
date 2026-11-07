# BRIEFING — 2026-11-06T21:13:00Z

## Mission
Implement Milestone 1 (M1: Core Backend & Relational DB) for the Restaurant Web App with PostgreSQL/PGlite dual engine, schema, seed, DB queries, eventHub SSE, and all required API route handlers.

## 🔒 My Identity
- Archetype: implementer
- Roles: [implementer, qa, specialist]
- Working directory: /Users/felipegaitan/projects/restaurant/.agents/teamwork/m1_worker_1/
- Original parent: e84a0498-4ac6-43a7-b21c-e535e5df7fca
- Milestone: M1: Core Backend & Relational DB

## 🔒 Key Constraints
- Pure PostgreSQL dialect with PGlite (WASM) / pg dual-mode. Auto-initialization on startup.
- UUID v4 idempotency_key for orders, unique index. Duplicate submission returns HTTP 200 with X-Idempotent-Replay: true and suppresses eventHub broadcast.
- Single global eventHub singleton on globalThis.__restaurant_event_hub__ with SSE keep-alive heartbeat and ring buffer.
- Server-side price calculation and modifier constraint enforcement (min/max selection).
- Exclusive file write ownership: package.json, tsconfig.json, lib/db/*, lib/events/*, types/*, app/api/*, app/layout.tsx, app/page.tsx, scripts/seed-db.ts.
- Prohibited from modifying tests/, TEST_INFRA.md, TEST_READY.md.
- Genuine implementation only: no mocks, hardcoded test strings or dummy facades.

## Current Parent
- Conversation ID: e84a0498-4ac6-43a7-b21c-e535e5df7fca
- Updated: 2026-11-06T21:13:00Z

## Task Summary
- **What to build**: Next.js app backend with PostgreSQL/PGlite database schema & seed, DB wrapper & query layer, event hub with SSE, types, and REST API routes (`/api/menu`, `/api/tables`, `/api/orders`, `/api/orders/[id]/status`, `/api/realtime`, and `/api/tables/[id]/*`).
- **Success criteria**: Clean compilation (`next build`), DB auto-boot and migration script, idempotent order creation, SSE event stream, passing tests and verification.
- **Interface contracts**: types/domain.ts, types/events.ts, PROJECT.md
- **Code layout**: PROJECT.md § Code Layout

## Key Decisions Made
- Used `VARCHAR(100)` primary keys with default `gen_random_uuid()::text` to seamlessly support both deterministic seed keys ('table-1', 'prod-burger-classic') and random UUIDs.
- Created `exec(sql)` on `DbClient` interface using `pglite.exec(sql)` to allow multi-statement DDL migration and seed scripts without prepared statement restrictions.
- Added recursive directory creation for `./data/pglite_db` to avoid ENOENT errors on first boot.
- Typed Next.js 15 route parameters as `Promise<{ id: string }>` in dynamic routes to satisfy Next.js 15 App Router requirements.
- Implemented `/api/tables/[id]/bill`, `/api/tables/[id]/pay`, and `/api/tables/[id]/close` under `app/api/tables/[id]/` to support full end-to-end billing and lifecycle settlement.

## Artifact Index
- .agents/teamwork/m1_worker_1/progress.md — Progress log & heartbeat
- .agents/teamwork/m1_worker_1/handoff.md — Final handoff report

## Change Tracker
- **Files modified**:
  - `package.json`: Configured Next.js 15, React 19, @electric-sql/pglite, pg, devDeps & test scripts.
  - `tsconfig.json`: Strict TS config, path alias `@/*`, `allowImportingTsExtensions: true`.
  - `lib/db/schema.sql`: PostgreSQL 16 DDL for tables, table_sessions, categories, products, modifier_groups, modifiers, product_modifier_groups, orders, order_items, order_item_modifiers, bills, payments.
  - `lib/db/seed.sql`: Deterministic seed data for 8 tables, categories, products, modifier groups and modifiers.
  - `lib/db/index.ts`: Dual-mode client (PGlite WASM / node-postgres) with automatic schema and seed initialization on first boot.
  - `lib/db/queries.ts`: Type-safe queries for tables, menu, atomic order creation, status update, billing and table closure.
  - `lib/events/eventHub.ts`: Singleton Node EventEmitter on `globalThis.__restaurant_event_hub__` with 15s heartbeats, ring buffer, and SSE broadcasting.
  - `types/domain.ts`: Core domain entity models and request/response DTOs.
  - `types/events.ts`: Realtime event discriminated unions.
  - `app/api/menu/route.ts`: Hierarchical menu catalog endpoint.
  - `app/api/tables/route.ts`: Restaurant tables oversight endpoint.
  - `app/api/orders/route.ts`: Atomic order ingestion with UUID v4 idempotency and SSE broadcasting.
  - `app/api/orders/[id]/status/route.ts`: KDS ticket status transitions with SSE broadcasting.
  - `app/api/realtime/route.ts`: Server-Sent Events stream endpoint.
  - `app/api/tables/[id]/bill/route.ts`: Table billing aggregation endpoint.
  - `app/api/tables/[id]/pay/route.ts`: Cashier payment processing endpoint.
  - `app/api/tables/[id]/close/route.ts`: Table settlement and release endpoint.
  - `app/layout.tsx`, `app/page.tsx`, `app/globals.css`: Base Next.js app scaffolding and navigation hub.
  - `scripts/seed-db.ts`: Standalone migration and seed runner.
- **Build status**: PASS (`next build` compiled cleanly)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (65/65 tests passed, verify-e2e passed with code 0)
- **Lint status**: PASS (Next.js validity of types check passed)
- **Tests added/modified**: All test suites in `tests/` pass with code 0.

## Loaded Skills
- None specified in dispatch
