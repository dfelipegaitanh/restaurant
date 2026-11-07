// ============================================================================
// adversarial_suite.ts — Empirical Stress-Testing Harness for M1 Backend
// Author: teamwork_challenger (m1_challenger_2)
// Location: .agents/teamwork/m1_challenger_2/adversarial_suite.ts
// ============================================================================

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, resetTestState, teardownTestServer } from '../../../tests/helpers/test-client.ts';
import { getDb } from '../../../lib/db/index.ts';

interface TestCaseResult {
  category: string;
  name: string;
  target: 'API/Mock' | 'PGlite DB' | 'End-to-End';
  status: 'PASS' | 'FAIL';
  details?: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

const testResults: TestCaseResult[] = [];

function recordTest(
  category: string,
  name: string,
  target: 'API/Mock' | 'PGlite DB' | 'End-to-End',
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  fn: () => Promise<void> | void
) {
  return async () => {
    try {
      await fn();
      testResults.push({ category, name, target, status: 'PASS', criticality });
      console.log(`  \x1b[32m✔ [PASS]\x1b[0m [${criticality}] ${category}: ${name}`);
    } catch (err: any) {
      testResults.push({
        category,
        name,
        target,
        status: 'FAIL',
        criticality,
        details: err.message,
      });
      console.log(`  \x1b[31m✖ [FAIL]\x1b[0m [${criticality}] ${category}: ${name}`);
      console.log(`     \x1b[33mReason: ${err.message}\x1b[0m`);
    }
  };
}

async function runAdversarialSuite() {
  console.log('================================================================');
  console.log('  M1 ADVERSARIAL EMPIRICAL STRESS-TEST HARNESS (m1_challenger_2)');
  console.log('================================================================\n');

  resetTestState();
  const db = await getDb();

  // Helper to create an active test order via apiFetch
  async function createOrder(productId = 'prod-burger-classic', modIds = ['mod-doneness-med']) {
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: 'table-1',
        idempotency_key: crypto.randomUUID(),
        items: [
          {
            product_id: productId,
            quantity: 1,
            modifiers: modIds.map((id) => ({ modifier_id: id })),
          },
        ],
      }),
    });
    assert.strictEqual(res.status, 201, `Failed to create base order: ${JSON.stringify(res.data)}`);
    return res.data.order;
  }

  // --------------------------------------------------------------------------
  // SECTION 1: KDS STATE MACHINE TRANSITION GUARDS & ILLEGAL STATUS JUMPS
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 1: KDS State Machine & Illegal Status Jumps ---');

  await recordTest(
    'State Machine',
    'Reject illegal skip PENDING -> SERVED with HTTP 400',
    'API/Mock',
    'CRITICAL',
    async () => {
      const order = await createOrder();
      const res = await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'SERVED' }),
      });
      assert.strictEqual(res.status, 400, `Expected 400 for PENDING->SERVED, got ${res.status}`);
      assert.ok(
        res.data?.error?.toLowerCase().includes('transition') ||
        res.data?.error?.toLowerCase().includes('illegal') ||
        res.data?.error?.toLowerCase().includes('invalid'),
        `Unexpected error message: ${res.data?.error}`
      );
    }
  )();

  await recordTest(
    'State Machine',
    'Reject backward jump READY -> PENDING with HTTP 400',
    'API/Mock',
    'CRITICAL',
    async () => {
      const order = await createOrder();
      // Advance to IN_PREP
      await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_PREP' }),
      });
      // Advance to READY
      await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'READY' }),
      });
      // Attempt backward jump READY -> PENDING
      const res = await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PENDING' }),
      });
      assert.strictEqual(
        res.status,
        400,
        `Expected 400 rejecting READY -> PENDING backward jump, but got status ${res.status}!`
      );
    }
  )();

  await recordTest(
    'State Machine',
    'Reject transition on CANCELLED order (CANCELLED -> IN_PREP) with HTTP 400',
    'API/Mock',
    'CRITICAL',
    async () => {
      const order = await createOrder();
      // Cancel order
      const cancelRes = await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      assert.strictEqual(cancelRes.status, 200);

      // Attempt transition on cancelled order
      const res = await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_PREP' }),
      });
      assert.strictEqual(res.status, 400, `Expected 400 on cancelled order, got ${res.status}`);
    }
  )();

  await recordTest(
    'State Machine',
    'Reject terminal state transitions from SERVED (SERVED -> PENDING, SERVED -> CANCELLED)',
    'API/Mock',
    'HIGH',
    async () => {
      const order = await createOrder();
      await apiFetch(`/api/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'IN_PREP' }) });
      await apiFetch(`/api/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'READY' }) });
      await apiFetch(`/api/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'SERVED' }) });

      // Attempt SERVED -> PENDING
      const resPending = await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PENDING' }),
      });
      assert.strictEqual(resPending.status, 400, `Expected 400 for SERVED -> PENDING, got ${resPending.status}`);

      // Attempt SERVED -> CANCELLED
      const resCancel = await apiFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      assert.strictEqual(resCancel.status, 400, `Expected 400 for SERVED -> CANCELLED, got ${resCancel.status}`);
    }
  )();

  await recordTest(
    'State Machine',
    'Reject arbitrary / malformed status strings (e.g. COOKING, null, 123) with HTTP 400',
    'API/Mock',
    'MEDIUM',
    async () => {
      const order = await createOrder();
      for (const bad of ['COOKING', 'DELIVERED', '', 123, null, 'DROPPED']) {
        const res = await apiFetch(`/api/orders/${order.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: bad }),
        });
        assert.strictEqual(res.status, 400, `Expected 400 for invalid status '${bad}', got ${res.status}`);
      }
    }
  )();

  // --------------------------------------------------------------------------
  // SECTION 2: RELATIONAL MODIFIER CARDINALITY VIOLATIONS
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Relational Modifier Cardinality Violations ---');

  await recordTest(
    'Cardinality',
    'Reject order with 0 modifiers for group with min_selection = 1 (Burger Doneness)',
    'API/Mock',
    'CRITICAL',
    async () => {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: 'table-1',
          idempotency_key: crypto.randomUUID(),
          items: [
            {
              product_id: 'prod-burger-classic',
              quantity: 1,
              modifiers: [], // 0 modifiers provided
            },
          ],
        }),
      });
      assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
      assert.ok(
        res.data?.error?.includes('minimum 1') || res.data?.error?.includes('requires minimum'),
        `Error message did not indicate min_selection: ${res.data?.error}`
      );
    }
  )();

  await recordTest(
    'Cardinality',
    'Reject order with 2 modifiers for group with max_selection = 1 (Burger Doneness)',
    'API/Mock',
    'CRITICAL',
    async () => {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: 'table-1',
          idempotency_key: crypto.randomUUID(),
          items: [
            {
              product_id: 'prod-burger-classic',
              quantity: 1,
              modifiers: [
                { modifier_id: 'mod-doneness-med' },
                { modifier_id: 'mod-doneness-well' }, // 2 selections in max=1 group
              ],
            },
          ],
        }),
      });
      assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
      assert.ok(
        res.data?.error?.includes('maximum 1') || res.data?.error?.includes('permits maximum'),
        `Error message did not indicate max_selection: ${res.data?.error}`
      );
    }
  )();

  await recordTest(
    'Cardinality',
    'Reject order exceeding multi-choice limit (4 toppings when max_selection = 3)',
    'API/Mock',
    'HIGH',
    async () => {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: 'table-1',
          idempotency_key: crypto.randomUUID(),
          items: [
            {
              product_id: 'prod-burger-classic',
              quantity: 1,
              modifiers: [
                { modifier_id: 'mod-doneness-med' },
                { modifier_id: 'mod-extra-bacon' },
                { modifier_id: 'mod-extra-cheese' },
                { modifier_id: 'mod-no-onion' },
                { modifier_id: 'mod-no-tomato' }, // 4 toppings in max=3 group
              ],
            },
          ],
        }),
      });
      assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
      assert.ok(
        res.data?.error?.includes('maximum 3') || res.data?.error?.includes('permits maximum 3'),
        `Error message did not indicate max 3: ${res.data?.error}`
      );
    }
  )();

  await recordTest(
    'Cardinality',
    'Reject modifier on products that define no modifier groups (e.g. Lemonade)',
    'API/Mock',
    'MEDIUM',
    async () => {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: 'table-1',
          idempotency_key: crypto.randomUUID(),
          items: [
            {
              product_id: 'prod-drink-lemonade',
              quantity: 1,
              modifiers: [{ modifier_id: 'mod-extra-bacon' }],
            },
          ],
        }),
      });
      assert.ok(
        res.status === 400 || res.status === 422,
        `Expected 400 or 422, got ${res.status}`
      );
      assert.ok(res.data?.error?.includes('not applicable'));
    }
  )();

  // --------------------------------------------------------------------------
  // SECTION 3: ROGUE MODIFIER IDS & FOREIGN INJECTION
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Rogue Modifier IDs & Foreign Injection ---');

  await recordTest(
    'Rogue Modifiers',
    'Reject cross-product modifier: Pizza Crust submitted on Burger',
    'API/Mock',
    'CRITICAL',
    async () => {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: 'table-1',
          idempotency_key: crypto.randomUUID(),
          items: [
            {
              product_id: 'prod-burger-classic',
              quantity: 1,
              modifiers: [
                { modifier_id: 'mod-doneness-med' },
                { modifier_id: 'mod-crust-cheese' }, // Belongs to pizza!
              ],
            },
          ],
        }),
      });
      assert.ok(
        res.status === 400 || res.status === 422,
        `Expected 400 or 422 for cross-product modifier, got ${res.status}`
      );
      assert.ok(
        res.data?.error?.includes('not applicable') || res.data?.error?.includes('mod-crust-cheese'),
        `Error must mention invalid modifier: ${res.data?.error}`
      );
    }
  )();

  await recordTest(
    'Rogue Modifiers',
    'Reject random non-existent UUID as modifier ID',
    'API/Mock',
    'CRITICAL',
    async () => {
      const fakeMod = crypto.randomUUID();
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: 'table-1',
          idempotency_key: crypto.randomUUID(),
          items: [
            {
              product_id: 'prod-burger-classic',
              quantity: 1,
              modifiers: [
                { modifier_id: 'mod-doneness-med' },
                { modifier_id: fakeMod },
              ],
            },
          ],
        }),
      });
      assert.ok(
        res.status === 400 || res.status === 422,
        `Expected 400 or 422 for non-existent modifier UUID, got ${res.status}`
      );
      assert.ok(
        res.data?.error?.includes('not applicable') || res.data?.error?.includes(fakeMod),
        `Error must indicate invalid modifier: ${res.data?.error}`
      );
    }
  )();

  await recordTest(
    'Rogue Modifiers',
    'Reject SQL injection in modifier ID: "\' OR \'1\'=\'1"',
    'API/Mock',
    'HIGH',
    async () => {
      const sqli = "' OR '1'='1";
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: 'table-1',
          idempotency_key: crypto.randomUUID(),
          items: [
            {
              product_id: 'prod-burger-classic',
              quantity: 1,
              modifiers: [
                { modifier_id: 'mod-doneness-med' },
                { modifier_id: sqli },
              ],
            },
          ],
        }),
      });
      assert.ok(
        res.status === 400 || res.status === 422,
        `Expected 400/422 rejecting SQL injection modifier, got ${res.status}`
      );
    }
  )();

  // --------------------------------------------------------------------------
  // SECTION 4: CLIENT PRICE TAMPERING & FINANCIAL RECONCILIATION
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Client Price Tampering & Calculation Reconciliation ---');

  await recordTest(
    'Price Tampering',
    'Server completely overrides client-provided unit_price, subtotal, and total_amount',
    'API/Mock',
    'CRITICAL',
    async () => {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: 'table-1',
          idempotency_key: crypto.randomUUID(),
          total_amount: 1, // Attacker sends 1 cent
          items: [
            {
              product_id: 'prod-burger-classic', // Base: 24.000
              quantity: 2,
              unit_price: 100, // Attacker sends 100
              subtotal: 200,   // Attacker sends 200
              price: 50,       // Attacker sends 50
              modifiers: [
                { modifier_id: 'mod-doneness-med', price_delta: -50000 }, // Attacker sends negative delta
                { modifier_id: 'mod-extra-bacon', price_delta: 0 },       // Attacker suppresses bacon price (4.500)
              ],
            },
          ],
        }),
      });

      assert.strictEqual(res.status, 201, `Order creation failed: ${JSON.stringify(res.data)}`);
      const order = res.data.order;

      // Expected calculation: (24000 base + 0 doneness + 4500 bacon) * 2 = 57000
      const expectedTotal = 57000;
      assert.strictEqual(
        order.total_amount,
        expectedTotal,
        `Total amount tampered! Expected ${expectedTotal}, got ${order.total_amount}`
      );

      // Verify line item subtotal
      assert.strictEqual(
        order.items[0].subtotal,
        expectedTotal,
        `Item subtotal tampered! Expected ${expectedTotal}, got ${order.items[0].subtotal}`
      );

      // Verify server-side modifier delta
      const baconMod = order.items[0].modifiers.find((m: any) => m.modifier_id === 'mod-extra-bacon');
      assert.strictEqual(
        baconMod.price_delta,
        4500,
        `Modifier delta tampered! Expected 4500, got ${baconMod.price_delta}`
      );
    }
  )();

  await recordTest(
    'Price Tampering',
    'Reject invalid / negative / non-integer quantities (e.g. -1, 0, 1.5, "two")',
    'API/Mock',
    'HIGH',
    async () => {
      const invalidQuantities = [-5, 0, 1.5, 'two', null, undefined];
      for (const q of invalidQuantities) {
        const res = await apiFetch('/api/orders', {
          method: 'POST',
          body: JSON.stringify({
            table_id: 'table-1',
            idempotency_key: crypto.randomUUID(),
            items: [
              {
                product_id: 'prod-burger-classic',
                quantity: q,
                modifiers: [{ modifier_id: 'mod-doneness-med' }],
              },
            ],
          }),
        });
        assert.strictEqual(res.status, 400, `Expected 400 for quantity ${q}, got ${res.status}`);
      }
    }
  )();

  await recordTest(
    'Price Math',
    'Financial reconciliation: subtotal, 8% Impoconsumo, 10% voluntary tip, cash change due',
    'API/Mock',
    'HIGH',
    async () => {
      const tableId = 'table-2';
      // Order 1: Pizza Margarita (28.000) + Borde Queso (5.000) = 33.000
      await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: tableId,
          idempotency_key: crypto.randomUUID(),
          items: [
            {
              product_id: 'prod-pizza-margarita',
              quantity: 1,
              modifiers: [{ modifier_id: 'mod-crust-cheese' }],
            },
          ],
        }),
      });

      // Order 2: Limonada Natural (7.000) x 2 = 14.000
      await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: tableId,
          idempotency_key: crypto.randomUUID(),
          items: [{ product_id: 'prod-drink-lemonade', quantity: 2, modifiers: [] }],
        }),
      });

      // Cashier Bill
      const billRes = await apiFetch(`/api/tables/${tableId}/bill`);
      assert.strictEqual(billRes.status, 200);
      const bill = billRes.data.bill;

      const expectedSubtotal = 33000 + 14000; // 47.000
      const expectedTax = Math.round(expectedSubtotal * 0.08); // 3.760 (8% Impoconsumo)
      const expectedTip = Math.round(expectedSubtotal * 0.1); // 4.700 (10% voluntary tip)
      const expectedTotal = expectedSubtotal + expectedTax + expectedTip; // 55.460

      assert.strictEqual(bill.subtotal, expectedSubtotal, `Subtotal mismatch: ${bill.subtotal} vs ${expectedSubtotal}`);
      assert.strictEqual(bill.tax, expectedTax, `Tax mismatch: ${bill.tax} vs ${expectedTax}`);
      assert.strictEqual(bill.tip, expectedTip, `Tip mismatch: ${bill.tip} vs ${expectedTip}`);
      assert.strictEqual(bill.total, expectedTotal, `Grand total mismatch: ${bill.total} vs ${expectedTotal}`);

      // Cash tender payment: 60.000 cash for 55.460 bill
      const payRes = await apiFetch(`/api/tables/${tableId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ payment_method: 'CASH', tendered_amount: 60000 }),
      });
      assert.strictEqual(payRes.status, 200);
      const expectedChange = 60000 - expectedTotal; // 4.540
      assert.strictEqual(payRes.data.change_due, expectedChange, `Change due mismatch: ${payRes.data.change_due} vs ${expectedChange}`);
    }
  )();

  // --------------------------------------------------------------------------
  // SECTION 5: RELATIONAL POSTGRESQL 16 & PGLITE DATABASE ENGINE CONSTRAINTS
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Relational PostgreSQL 16 (PGlite) Database Constraints ---');

  await recordTest(
    'PostgreSQL DDL',
    'orders table enforces idempotency_key UNIQUE constraint at DB layer',
    'PGlite DB',
    'CRITICAL',
    async () => {
      const fixedKey = crypto.randomUUID();
      // First insert
      await db.query(
        `INSERT INTO orders (table_id, idempotency_key, status, total_amount) VALUES ('table-1', $1, 'PENDING', 24000)`,
        [fixedKey]
      );

      // Second insert with identical idempotency_key must violate unique constraint
      try {
        await db.query(
          `INSERT INTO orders (table_id, idempotency_key, status, total_amount) VALUES ('table-1', $1, 'PENDING', 24000)`,
          [fixedKey]
        );
        assert.fail('Database failed to throw UNIQUE constraint violation for duplicate idempotency_key');
      } catch (err: any) {
        assert.ok(
          err.message.includes('unique constraint') || err.message.includes('duplicate key'),
          `Expected unique constraint violation, got: ${err.message}`
        );
      }
    }
  )();

  await recordTest(
    'PostgreSQL DDL',
    'order_item_modifiers enforces composite UNIQUE(order_item_id, modifier_id)',
    'PGlite DB',
    'CRITICAL',
    async () => {
      const orderRes = await db.query(
        `INSERT INTO orders (table_id, idempotency_key, status, total_amount) VALUES ('table-1', $1, 'PENDING', 28500) RETURNING id`,
        [crypto.randomUUID()]
      );
      const orderId = orderRes.rows[0].id;
      const itemRes = await db.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal) VALUES ($1, 'prod-burger-classic', 1, 28500, 28500) RETURNING id`,
        [orderId]
      );
      const itemId = itemRes.rows[0].id;

      // First modifier insert
      await db.query(
        `INSERT INTO order_item_modifiers (order_item_id, modifier_id, unit_price_delta) VALUES ($1, 'mod-extra-bacon', 4500)`,
        [itemId]
      );

      // Duplicate modifier insert on same line item
      try {
        await db.query(
          `INSERT INTO order_item_modifiers (order_item_id, modifier_id, unit_price_delta) VALUES ($1, 'mod-extra-bacon', 4500)`,
          [itemId]
        );
        assert.fail('Database allowed duplicate modifier on same order item!');
      } catch (err: any) {
        assert.ok(
          err.message.includes('unique constraint') || err.message.includes('duplicate key'),
          `Expected unique constraint violation, got: ${err.message}`
        );
      }
    }
  )();

  await recordTest(
    'PostgreSQL DDL',
    'orders table enforces CHECK constraint on valid status enum values',
    'PGlite DB',
    'HIGH',
    async () => {
      try {
        await db.query(
          `INSERT INTO orders (table_id, idempotency_key, status, total_amount) VALUES ('table-1', $1, 'COOKING_FAST', 10000)`,
          [crypto.randomUUID()]
        );
        assert.fail('Database allowed invalid status enum value!');
      } catch (err: any) {
        assert.ok(
          err.message.includes('check constraint') || err.message.includes('violates check constraint'),
          `Expected check constraint error, got: ${err.message}`
        );
      }
    }
  )();

  await recordTest(
    'PostgreSQL DDL',
    'Foreign key cascade & restrict integrity: reject order with invalid table_id',
    'PGlite DB',
    'HIGH',
    async () => {
      try {
        await db.query(
          `INSERT INTO orders (table_id, idempotency_key, status, total_amount) VALUES ('table-999-ghost', $1, 'PENDING', 10000)`,
          [crypto.randomUUID()]
        );
        assert.fail('Database allowed order referencing non-existent table!');
      } catch (err: any) {
        assert.ok(
          err.message.includes('foreign key constraint') || err.message.includes('violates foreign key constraint'),
          `Expected foreign key violation, got: ${err.message}`
        );
      }
    }
  )();

  await teardownTestServer();

  // --------------------------------------------------------------------------
  // SUMMARY REPORT & SCORING
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                 ADVERSARIAL SUITE SUMMARY');
  console.log('================================================================');

  const total = testResults.length;
  const passed = testResults.filter((r) => r.status === 'PASS').length;
  const failed = testResults.filter((r) => r.status === 'FAIL').length;

  console.log(`Total Adversarial Tests: ${total}`);
  console.log(`Passed: \x1b[32m${passed}\x1b[0m`);
  console.log(`Failed: \x1b[31${failed > 0 ? ';1m' : 'm'}${failed}\x1b[0m`);

  if (failed > 0) {
    console.log('\nFailed Tests Detail:');
    testResults
      .filter((r) => r.status === 'FAIL')
      .forEach((r, idx) => {
        console.log(`  ${idx + 1}. [${r.criticality}] [${r.category}] ${r.name}`);
        console.log(`     Error: ${r.details}`);
      });
  }

  console.log('================================================================\n');

  return { total, passed, failed, results: testResults };
}

runAdversarialSuite()
  .then((summary) => {
    // Exit with 0 if no critical failures, or 1 if critical failures exist
    const criticalFails = summary.results.filter((r) => r.status === 'FAIL' && r.criticality === 'CRITICAL');
    if (criticalFails.length > 0) {
      console.error(`\x1b[31mCRITICAL ADVERSARIAL FAILURES DETECTED: ${criticalFails.length}\x1b[0m`);
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal crash in adversarial runner:', err);
    process.exit(2);
  });
