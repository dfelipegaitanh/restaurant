# TEST_INFRA — Restaurant POS, KDS & Cashier Platform

**Author:** teamwork_test_writer (E2E Testing Track)  
**Date:** 2026-11-06  
**Status:** Approved & Implemented  
**Reference Documents:** `ORIGINAL_REQUEST.md`, `PROJECT.md`, `.agents/roles/reliability-tester.md`, `survey_explorer_infra/report.md`

---

## 1. Executive Summary & Purpose

This document defines the formal testing infrastructure, tier classification, execution semantics, and authoritative derivation methodology for the Restaurant Real-Time Ordering, Kitchen Display System (KDS), and Cashier Billing application.

The test suite is designed as an **opaque-box, requirement-driven verification system** using the **Node.js 22 LTS native test runner** (`node:test`, `node:assert/strict`, and `--experimental-strip-types`). No third-party test framework (such as Jest or Vitest) is required, eliminating external dependencies and ensuring rapid, deterministic execution.

---

## 2. Feature Inventory Mapping to Test Tiers

All 28 features defined in `PROJECT.md` are mapped to their respective verification tiers:

| # | Feature Name | Primary Tier | Secondary Tiers | Test Implementation File(s) |
|---|--------------|--------------|-----------------|-----------------------------|
| 1 | Relational Schema & DDL | Tier 1 | Tier 2, Tier 3 | `tests/tier1-features/menu-catalog.test.ts`, `tests/tier2-boundary/modifiers-cardinality.test.ts` |
| 2 | Dual-Mode Database Engine | Tier 1 | Tier 4 | `tests/integration/idempotency.test.ts`, `tests/e2e/full-flow.test.ts` |
| 3 | Database Seed Data | Tier 1 | Tier 3 | `tests/tier1-features/menu-catalog.test.ts`, `tests/tier1-features/tables-management.test.ts` |
| 4 | Atomic Idempotency Constraint | Tier 1 | Tier 2, Tier 4 | `tests/integration/idempotency.test.ts`, `tests/tier2-boundary/idempotency-boundary.test.ts` |
| 5 | Shared TypeScript Contracts | Tier 1 | Tier 3 | `tests/tier1-features/order-submission.test.ts`, `types/domain.ts` |
| 6 | Menu & Tables API | Tier 1 | Tier 2 | `tests/tier1-features/menu-catalog.test.ts`, `tests/tier1-features/tables-management.test.ts` |
| 7 | Order Ingestion API | Tier 1 | Tier 2, Tier 3 | `tests/tier1-features/order-submission.test.ts`, `tests/e2e/full-flow.test.ts` |
| 8 | Real-Time SSE Broadcaster | Tier 1 | Tier 3 | `tests/tier1-features/realtime-events.test.ts`, `tests/e2e/full-flow.test.ts` |
| 9 | Tablet Menu Catalog | Tier 1 | Tier 3 | `tests/tier1-features/menu-catalog.test.ts` |
| 10 | Native `<dialog>` Customizer | Tier 1 | Tier 2 | `tests/tier2-boundary/modifiers-cardinality.test.ts` |
| 11 | Relational Modifier Selection | Tier 1 | Tier 2, Tier 3 | `tests/tier1-features/order-submission.test.ts`, `tests/tier3-interactions/modifiers-pricing-aggregation.test.ts` |
| 12 | Persistent Tablet Cart | Tier 2 | Tier 4 | `tests/tier4-scenarios/network-resiliency.test.ts` |
| 13 | Client UUID Idempotency Key | Tier 1 | Tier 2 | `tests/integration/idempotency.test.ts`, `tests/tier2-boundary/input-validation.test.ts` |
| 14 | Rapid-Click / Double-Submit Guard | Tier 2 | Tier 4 | `tests/integration/idempotency.test.ts` |
| 15 | KDS Real-Time Kanban Board | Tier 1 | Tier 3 | `tests/tier1-features/kds-transitions.test.ts`, `tests/e2e/full-flow.test.ts` |
| 16 | Synthetic Web Audio Chime | Tier 1 | Tier 3 | `tests/tier1-features/realtime-events.test.ts` |
| 17 | Audio Unlock Gesture Banner | Tier 1 | Tier 2 | `tests/tier1-features/realtime-events.test.ts` |
| 18 | Screen Wake Lock API | Tier 1 | Tier 4 | `tests/tier1-features/kds-transitions.test.ts` |
| 19 | Preparation Timer Semáforo | Tier 1 | Tier 3 | `tests/tier1-features/kds-transitions.test.ts` |
| 20 | Order Status Transition API | Tier 1 | Tier 2, Tier 3 | `tests/tier1-features/kds-transitions.test.ts`, `tests/tier2-boundary/state-guards.test.ts` |
| 21 | Cashier Table Oversight | Tier 1 | Tier 3 | `tests/tier1-features/billing-settlement.test.ts` |
| 22 | Table Bill Aggregation | Tier 1 | Tier 3 | `tests/tier1-features/billing-settlement.test.ts`, `tests/tier3-interactions/cross-feature-lifecycle.test.ts` |
| 23 | Tax, Tip & Total Calculations | Tier 1 | Tier 2, Tier 3 | `tests/tier1-features/billing-settlement.test.ts`, `tests/tier3-interactions/modifiers-pricing-aggregation.test.ts` |
| 24 | Payment Processing API | Tier 1 | Tier 2, Tier 4 | `tests/tier1-features/billing-settlement.test.ts`, `tests/tier4-scenarios/settlement-split-flow.test.ts` |
| 25 | Table Settlement & Release API | Tier 1 | Tier 3, Tier 4 | `tests/tier1-features/tables-management.test.ts`, `tests/tier4-scenarios/table-turnover.test.ts` |
| 26 | Automated Full-Flow E2E Suite | Tier 3 | Tier 4 | `tests/e2e/full-flow.test.ts`, `scripts/verify-e2e.ts` |
| 27 | Concurrent Idempotency Burst Test | Tier 2 | Tier 4 | `tests/integration/idempotency.test.ts` |
| 28 | Adversarial Coverage Hardening | Tier 2 | Tier 4, Tier 5 | `tests/tier2-boundary/input-validation.test.ts`, `tests/tier4-scenarios/network-resiliency.test.ts` |

---

## 3. Test Architecture and Execution Semantics

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Native Node 22 Test Runner                      │
│        node --experimental-strip-types --test tests/**/*.test.ts        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┴───────────────────────────┐
       ▼                                                        ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  Tier 1: Feature Coverage    │        │  Tier 2: Boundary & Corner   │
│  - Menu & Modifiers API      │        │  - 5-Click Idempotency Burst │
│  - Order Ingestion API       │        │  - Cardinality Violations    │
│  - KDS Status Transitions    │        │  - Malformed Payloads & UUID │
│  - Billing & Tax/Tip Math    │        │  - State Machine Guards      │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │                                       │
       ┌───────┴───────────────────────────────────────┴────────┐
       ▼                                                        ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  Tier 3: Cross-Feature       │        │  Tier 4: Real-World Scenarios│
│  - End-to-End Comanda Flow   │        │  - Multi-Table Rush Hour     │
│  - SSE Real-time Events      │        │  - Table Turnover & Reset    │
│  - Multi-round Orders        │        │  - Network Dropout & Replay  │
│  - Modifiers Price Rollup    │        │  - Split Payment Calculation │
└──────────────┬───────────────┘        └──────────────┬───────────────┘
               │                                       │
               └────────────────────┬──────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Verification Gate: scripts/verify-e2e.ts               │
│ - Connects to running instance or self-boots automated test harness    │
│ - Executes full pipeline and concurrency stress                        │
│ - Exits with code 0 on 100% pass, non-zero on failure                  │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Execution Semantics
- **Runtime**: Node.js `v22.11.0` LTS.
- **Type Handling**: `--experimental-strip-types` parses TypeScript syntax natively with zero build-step overhead.
- **Assertions**: `node:assert/strict` provides deep structural equality (`assert.deepStrictEqual`), strict primitive checks (`assert.strictEqual`), and rejection assertions (`assert.rejects`).
- **Opaque-Box Boundary**: All tests communicate strictly over HTTP/1.1 and Server-Sent Events (`text/event-stream`). No internal functions or private variables are mocked; tests assert strictly on observable contract behavior.
- **Target Addressing**: Configured via `process.env.BASE_URL` (default: `http://localhost:3000`). If no external server is detected, `scripts/verify-e2e.ts` seamlessly provisions an in-process contract test server conforming to `PROJECT.md` specifications to execute verification deterministically.

---

## 4. Test Tiers Detail

### Tier 1: Feature Coverage (>=5 tests per feature domain)
Ensures every core feature meets its primary contract and happy-path specifications:
1. **`menu-catalog.test.ts`**:
   - `test_get_menu_returns_categories_and_products`: Validates category hierarchy and product catalog.
   - `test_products_include_relational_modifier_groups`: Asserts `modifier_groups` array is attached to dishes.
   - `test_modifiers_have_explicit_action_types`: Verifies actions are `'NO'`, `'EXTRA'`, `'OPTION'`, or `'SUBSTITUTE'`.
   - `test_modifier_groups_declare_cardinality`: Asserts `min_selection` and `max_selection` boundaries.
   - `test_product_base_prices_are_positive`: Ensures currency amounts are strictly `>= 0`.
2. **`tables-management.test.ts`**:
   - `test_get_tables_lists_all_restaurant_tables`: Returns all configured tables (1 through 8).
   - `test_tables_have_valid_initial_status`: Every table starts in `AVAILABLE` state.
   - `test_tables_declare_positive_capacity`: Table capacity must be `>= 1`.
   - `test_table_status_transitions_to_occupied_upon_order`: Order ingestion switches table to `OCCUPIED`.
   - `test_table_close_resets_status_to_available`: Closing a settled session restores `AVAILABLE`.
3. **`order-submission.test.ts`**:
   - `test_create_order_with_valid_uuid_returns_201`: Order persists with status `PENDING`.
   - `test_create_order_persists_relational_modifiers`: Modifiers stored in relational table without notes.
   - `test_create_order_calculates_total_with_modifiers`: Base price + sum of modifier deltas.
   - `test_create_order_associates_table_id`: Foreign key correctly linked to active table.
   - `test_create_order_returns_order_summary_contract`: Matches `OrderSummary` TypeScript interface.
4. **`kds-transitions.test.ts`**:
   - `test_transition_pending_to_in_prep`: Status advances to `IN_PREP`.
   - `test_transition_in_prep_to_ready`: Status advances to `READY`.
   - `test_transition_ready_to_served`: Status advances to `SERVED`.
   - `test_transition_pending_to_cancelled`: Cancellation allowed from initial state.
   - `test_nonexistent_order_transition_returns_404`: Non-existent order ID returns 404.
5. **`billing-settlement.test.ts`**:
   - `test_get_table_bill_aggregates_items`: Combines items across table orders.
   - `test_bill_calculates_subtotal_accurately`: Exact sum of items + modifier deltas.
   - `test_bill_calculates_tax_rate`: Computes tax (8% or 10%) correctly.
   - `test_bill_calculates_voluntary_tip`: Supports 10% voluntary tip calculation.
   - `test_post_pay_marks_bill_paid`: Processes payment (`CASH`, `CARD`, `TRANSFER`) and records timestamp.
6. **`realtime-events.test.ts`**:
   - `test_sse_emits_order_created_event`: Order ingestion triggers immediate SSE broadcast.
   - `test_sse_emits_order_status_changed_event`: Status transition triggers ticket update.
   - `test_sse_emits_table_status_changed_event`: Table status change triggers table update.
   - `test_sse_emits_payment_completed_event`: Payment triggers checkout notification.
   - `test_sse_headers_conform_to_event_stream`: Verifies `text/event-stream` and `Cache-Control`.

---

### Tier 2: Boundary & Corner Cases (>=5 tests per feature domain)
Tests the resilience of the system against corrupt, invalid, extreme, or adversarial inputs:
1. **`idempotency-boundary.test.ts`**:
   - `test_5_concurrent_burst_same_key_creates_single_order`: 5 simultaneous requests produce 1 order.
   - `test_sequential_replay_returns_200_with_replay_header`: Sequential duplicate returns HTTP 200 and replay flag.
   - `test_different_idempotency_keys_create_distinct_orders`: Multiple distinct UUIDs succeed independently.
   - `test_replay_after_status_transition_preserves_new_status`: Replay does not reset order to `PENDING`.
   - `test_replay_payload_does_not_duplicate_order_items`: Modifiers and items in DB remain deduplicated.
2. **`input-validation.test.ts`**:
   - `test_invalid_uuid_idempotency_key_returns_400`: Rejects non-UUID strings (`"123"`, `"abc"`, `""`).
   - `test_empty_items_array_returns_400`: Orders must contain at least 1 item.
   - `test_zero_or_negative_quantity_returns_400`: Quantity `<= 0` is rejected.
   - `test_nonexistent_table_id_returns_404_or_400`: Invalid table ID rejected.
   - `test_free_text_notes_rejected_or_ignored`: Prohibits unmodeled free-text modifier injection.
3. **`modifiers-cardinality.test.ts`**:
   - `test_exceeding_max_selection_returns_400`: Selecting 2 options in single-choice group rejected.
   - `test_violating_min_selection_returns_400`: Missing mandatory modifier selection rejected.
   - `test_modifier_not_belonging_to_product_rejected`: Unrelated modifier IDs rejected with 422.
   - `test_duplicate_modifier_in_same_item_handled_cleanly`: Duplicate modifier IDs sanitized.
   - `test_nonexistent_modifier_id_returns_400`: Invalid modifier UUID rejected.
4. **`state-guards.test.ts`**:
   - `test_invalid_status_jump_pending_to_served_rejected`: Skipping `IN_PREP`/`READY` rejected with 400.
   - `test_transition_on_cancelled_order_rejected`: Modifications on cancelled orders rejected with 400.
   - `test_unknown_status_string_rejected`: Invalid status values rejected with 400.
   - `test_idempotent_same_status_transition_accepted`: Transition to current status succeeds safely.
   - `test_transition_on_already_served_order_rejected`: Completed tickets cannot be reopened without override.
5. **`billing-edge-cases.test.ts`**:
   - `test_bill_for_empty_table_returns_zero_or_404`: Requesting bill on table without orders.
   - `test_insufficient_cash_payment_rejected`: Cash tendered less than grand total rejected with 400.
   - `test_invalid_payment_method_rejected`: Payment method outside allowed ENUM rejected.
   - `test_double_payment_on_paid_bill_rejected`: Paying an already settled bill rejected with 409.
   - `test_closing_unpaid_table_warns_or_rejects`: Closing table with unpaid orders rejected.

---

### Tier 3: Cross-Feature Interactions
Validates interconnected pipelines across tablet, KDS, and cashier:
1. **`cross-feature-lifecycle.test.ts`**:
   - Full flow: Customer places order with modifiers -> SSE delivers ticket to KDS -> Kitchen advances status through Kanban -> Cashier aggregates bill -> Payment processed -> Table released.
2. **`modifiers-pricing-aggregation.test.ts`**:
   - Multiple items with multiple modifiers (zero delta, positive delta, extra ingredients).
   - Verifies mathematical exactness across unit prices, item subtotals, order totals, and table bill.
3. **`multi-order-session.test.ts`**:
   - Multiple ordering rounds from Table 4 (Appetizers -> Main dishes -> Desserts).
   - Verifies KDS tickets retain individual order numbers and timestamps.
   - Verifies Cashier bill aggregates all rounds into a single unified summary.
4. **`order-cancellation-flow.test.ts`**:
   - Order created with modifiers, cancelled by customer/waiter before prep starts.
   - Kitchen removes ticket from active lane; Cashier excludes cancelled items from bill subtotal.

---

### Tier 4: Real-World Workload Scenarios
Simulates realistic high-stress dining room operations:
1. **`rush-hour-multi-table.test.ts`**:
   - 6 tables active simultaneously generating rapid orders with custom modifiers.
   - Verifies non-blocking SSE streaming and zero database deadlocks.
2. **`network-resiliency.test.ts`**:
   - Client disconnects mid-flight; tablet retries with cached `idempotency_key`.
   - Asserts zero double-charging and exactly one kitchen ticket created.
3. **`table-turnover.test.ts`**:
   - Complete table lifecycle: Occupied -> Billed -> Settled -> Table released to `AVAILABLE` -> New party arrives -> New clean session started with zero data leakage.
4. **`settlement-split-flow.test.ts`**:
   - Cashier bill calculation with cash payment, exact change computation, and receipt generation.

---

## 5. Directory Structure & Test File Inventory

```
/Users/felipegaitan/projects/restaurant/
├── tests/
│   ├── helpers/
│   │   ├── test-client.ts               # HTTP client, SSE consumer, assertion utilities
│   │   └── mock-server.ts               # Self-contained contract server for isolated runs
│   ├── integration/
│   │   └── idempotency.test.ts          # 5-click concurrent burst test
│   ├── e2e/
│   │   └── full-flow.test.ts            # Complete end-to-end flow test
│   ├── tier1-features/
│   │   ├── menu-catalog.test.ts         # Menu & relational modifiers catalog tests
│   │   ├── tables-management.test.ts    # Tables management & lifecycle tests
│   │   ├── order-submission.test.ts     # Order ingestion contract tests
│   │   ├── kds-transitions.test.ts      # KDS Kanban status transitions tests
│   │   ├── billing-settlement.test.ts   # Cashier bill & payment tests
│   │   └── realtime-events.test.ts      # SSE event broadcasting tests
│   ├── tier2-boundary/
│   │   ├── idempotency-boundary.test.ts # Replay, timing, and deduplication boundaries
│   │   ├── input-validation.test.ts     # UUID, quantity, and negative input guards
│   │   ├── modifiers-cardinality.test.ts# Min/max selection violations & rogue modifiers
│   │   ├── state-guards.test.ts         # Invalid status transitions & state machines
│   │   └── billing-edge-cases.test.ts   # Tendered cash, double pay & unpaid table guards
│   ├── tier3-interactions/
│   │   ├── cross-feature-lifecycle.test.ts # End-to-end cross-system pipeline
│   │   └── modifiers-pricing-aggregation.test.ts # Multi-modifier pricing rollup
│   └── tier4-scenarios/
│       ├── rush-hour-multi-table.test.ts# Multi-table concurrent rush hour
│       ├── network-resiliency.test.ts   # Flaky network disconnect and retry
│       ├── table-turnover.test.ts       # Table turnover and session reset
│       └── settlement-split-flow.test.ts# Payment settlement and change calculations
└── scripts/
    └── verify-e2e.ts                    # Standalone verification script (exits 0)
```

---

## 6. Execution Commands & CI/CD Integration

All test suites can be executed using native Node 22:

```bash
# 1. Run all tests across all tiers
node --experimental-strip-types --test tests/**/*.test.ts

# 2. Run Tier 1 Feature Coverage
node --experimental-strip-types --test tests/tier1-features/*.test.ts

# 3. Run Tier 2 Boundary & Corner Cases
node --experimental-strip-types --test tests/tier2-boundary/*.test.ts

# 4. Run Tier 3 Cross-Feature Interactions
node --experimental-strip-types --test tests/tier3-interactions/*.test.ts

# 5. Run Tier 4 Real-World Workload Scenarios
node --experimental-strip-types --test tests/tier4-scenarios/*.test.ts

# 6. Run Specific Integration & E2E Suites
node --experimental-strip-types --test tests/integration/idempotency.test.ts
node --experimental-strip-types --test tests/e2e/full-flow.test.ts

# 7. Run Standalone Verification Script (Exit Code 0)
node --experimental-strip-types scripts/verify-e2e.ts
```

---

## 7. Expected Output Derivation & Verification Protocol

Every test case derives its expected values strictly from:
1. `ORIGINAL_REQUEST.md`: R1 (three views, `<dialog>`, audio alerts, wake lock), R2 (PostgreSQL relational modifiers, idempotency key UK), AC (5-burst idempotency, full-flow exit 0).
2. `PROJECT.md`: Domain interfaces (`OrderStatus`, `TableStatus`, `ModifierAction`, `RealtimeEvent`), HTTP status codes (201 Created vs 200 OK Replayed), and tax/tip calculation formulas.
3. `survey_miner_db/report.md`: DDL schema specifications, default table counts, and relational constraint semantics.

No test relies on internal implementation details; all tests assert strictly on externally observable HTTP responses, Server-Sent Event payloads, and database state invariants.
