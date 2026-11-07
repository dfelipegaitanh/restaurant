#!/usr/bin/env node

/**
 * Standalone E2E Verification Script
 * Validates the full restaurant flow, idempotency bursts, and multi-tier contracts.
 * Exits with code 0 on complete pass.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  apiFetch,
  captureRealtimeEvent,
  resetTestState,
  teardownTestServer,
} from '../tests/helpers/test-client.ts';

interface StepResult {
  step: string;
  durationMs: number;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const results: StepResult[] = [];

async function recordStep(name: string, fn: () => Promise<string | void>) {
  const start = performance.now();
  process.stdout.write(`  ▶ Running: ${name}... `);
  try {
    const details = await fn();
    const duration = Math.round(performance.now() - start);
    results.push({ step: name, durationMs: duration, status: 'PASS', details: details || undefined });
    console.log(`\x1b[32m✔ PASS\x1b[0m (${duration}ms)`);
  } catch (err: any) {
    const duration = Math.round(performance.now() - start);
    results.push({ step: name, durationMs: duration, status: 'FAIL', details: err.message });
    console.log(`\x1b[31m✖ FAIL\x1b[0m (${duration}ms)`);
    console.error(`\x1b[31m    Error: ${err.message}\x1b[0m`);
    throw err;
  }
}

async function main() {
  console.log('\n================================================================');
  console.log('  RESTAURANT PLATFORM: FULL E2E AUTOMATED VERIFICATION SUITE');
  console.log('================================================================\n');

  resetTestState();

  try {
    // 1. Menu Catalog & Modifiers Contract
    await recordStep('1. Menu Catalog & Relational Modifiers Verification', async () => {
      const res = await apiFetch('/api/menu');
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.products.length >= 3, 'Must return at least 3 menu products');

      const burger = res.data.products.find((p: any) => p.name.includes('Hamburguesa'));
      assert.ok(burger, 'Hamburguesa must be available');
      assert.ok(burger.modifier_groups.length >= 2, 'Burger must have at least 2 modifier groups');
      return `${res.data.products.length} products loaded with relational modifiers`;
    });

    // 2. Table Management State
    await recordStep('2. Table Oversight Initial State (8 Tables Available)', async () => {
      const res = await apiFetch('/api/tables');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.tables.length, 8, 'Must return 8 configured tables');
      for (const t of res.data.tables) {
        assert.strictEqual(t.status, 'AVAILABLE');
      }
      return 'All 8 restaurant tables verified AVAILABLE';
    });

    // 3. Concurrency Burst & Idempotency
    await recordStep('3. Concurrency Burst: 5-Click Rapid Idempotency Guard', async () => {
      const burstKey = crypto.randomUUID();
      const payload = {
        table_id: 'table-3',
        idempotency_key: burstKey,
        items: [
          {
            product_id: 'prod-burger-classic',
            quantity: 2,
            modifiers: [{ modifier_id: 'mod-doneness-med' }, { modifier_id: 'mod-extra-bacon' }],
          },
        ],
      };

      const promises = Array.from({ length: 5 }, () =>
        apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(payload) })
      );
      const responses = await Promise.all(promises);

      // Verify all responses succeeded
      for (const r of responses) {
        assert.ok(r.status === 201 || r.status === 200);
      }

      // Exactly 1 initial creation (201) and 4 replays (200)
      const count201 = responses.filter((r) => r.status === 201).length;
      assert.strictEqual(count201, 1, `Expected exactly 1 HTTP 201, got ${count201}`);

      // All return identical order ID
      const orderIds = new Set(responses.map((r) => r.data.order.id));
      assert.strictEqual(orderIds.size, 1, 'Burst produced multiple distinct order IDs');

      return '5 concurrent submissions deduplicated into exactly 1 comanda';
    });

    // 4. Full Flow: Table Order -> KDS Kanban -> Cashier Checkout
    await recordStep('4. Full Lifecycle Flow: Order -> KDS Kanban -> Cashier Settle', async () => {
      const tableId = 'table-5';
      const orderKey = crypto.randomUUID();

      // Listen for SSE event
      const sseCreated = captureRealtimeEvent(
        (e) => e.type === 'ORDER_CREATED' && e.payload.order.table_id === tableId
      );

      // 4a. Order Creation: Hamburguesa (24000) + Término Medio (0) + Extra Bacon (4500) = 28500
      const orderRes = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: tableId,
          idempotency_key: orderKey,
          items: [
            {
              product_id: 'prod-burger-classic',
              quantity: 1,
              modifiers: [{ modifier_id: 'mod-doneness-med' }, { modifier_id: 'mod-extra-bacon' }],
            },
          ],
        }),
      });
      assert.strictEqual(orderRes.status, 201);
      const order = orderRes.data.order;
      assert.strictEqual(order.total_amount, 28500);

      const eventCreated = await sseCreated;
      assert.strictEqual(eventCreated.payload.order.id, order.id);

      // 4b. Kitchen Kanban Progression: PENDING -> IN_PREP -> READY -> SERVED
      const prepRes = await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_PREP' }),
      });
      assert.strictEqual(prepRes.status, 200);

      const readyRes = await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'READY' }),
      });
      assert.strictEqual(readyRes.status, 200);

      const servedRes = await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'SERVED' }),
      });
      assert.strictEqual(servedRes.status, 200);

      // 4c. Cashier Bill & Exact Calculations
      const billRes = await apiFetch(`/api/tables/${tableId}/bill`);
      assert.strictEqual(billRes.status, 200);
      const bill = billRes.data.bill;
      assert.strictEqual(bill.subtotal, 28500);
      assert.strictEqual(bill.tax, 2280); // 8% Impoconsumo
      assert.strictEqual(bill.tip, 2850); // 10% voluntary tip
      assert.strictEqual(bill.total, 33630);

      // 4d. Payment Processing (50.000 Cash Tendered)
      const payRes = await apiFetch(`/api/tables/${tableId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ payment_method: 'CASH', tendered_amount: 50000 }),
      });
      assert.strictEqual(payRes.status, 200);
      assert.strictEqual(payRes.data.bill.status, 'PAID');
      assert.strictEqual(payRes.data.change_due, 16370);

      // 4e. Table Settlement & Release
      const closeRes = await apiFetch(`/api/tables/${tableId}/close`, { method: 'POST' });
      assert.strictEqual(closeRes.status, 200);
      assert.strictEqual(closeRes.data.status, 'AVAILABLE');

      return 'Complete comanda lifecycle traversed with exact financial math';
    });

    // 5. Multi-Table Rush Hour Simulation
    await recordStep('5. Multi-Table Rush Hour Stress (Concurrent Dining Sessions)', async () => {
      const activeTables = ['table-1', 'table-2', 'table-4', 'table-6', 'table-7', 'table-8'];
      const rushPromises = activeTables.map((tid) =>
        apiFetch('/api/orders', {
          method: 'POST',
          body: JSON.stringify({
            table_id: tid,
            idempotency_key: crypto.randomUUID(),
            items: [{ product_id: 'prod-fries-rustic', quantity: 1, modifiers: [] }],
          }),
        })
      );
      const rushResponses = await Promise.all(rushPromises);
      for (const res of rushResponses) {
        assert.strictEqual(res.status, 201);
      }
      return `${activeTables.length} tables ingested concurrently without deadlock`;
    });

    await teardownTestServer();

    // Summary output
    console.log('\n================================================================');
    console.log('                     VERIFICATION SUMMARY');
    console.log('================================================================');
    console.log('| # | Verification Step                             | Time   | Status |');
    console.log('|---|-----------------------------------------------|--------|--------|');
    results.forEach((r, idx) => {
      const num = String(idx + 1).padEnd(2);
      const name = r.step.padEnd(47).substring(0, 47);
      const time = `${r.durationMs}ms`.padStart(6);
      const status = r.status === 'PASS' ? '\x1b[32mPASS\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m  ';
      console.log(`| ${num}| ${name} | ${time} | ${status} |`);
    });
    console.log('================================================================');
    console.log('\x1b[32m✔ ALL ACCEPTANCE CRITERIA SATISFIED — EXITING CODE 0\x1b[0m\n');

    process.exit(0);
  } catch (fatalError: any) {
    await teardownTestServer();
    console.error('\n\x1b[31mVERIFICATION FAILED WITH UNHANDLED ERROR:\x1b[0m');
    console.error(fatalError);
    process.exit(1);
  }
}

main();
