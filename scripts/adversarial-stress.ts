// ============================================================================
// scripts/adversarial-stress.ts — Adversarial Idempotency & Concurrency Harness
// Empirically stress-tests the real backend (PGlite WASM DB, API route, queries, SSE)
// ============================================================================

import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

// Create jiti loader with alias mapping for '@/...' imports
const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');

// @ts-ignore
import jitiFactory from 'jiti';
const jiti = jitiFactory(path.join(rootDir, 'dummy.js'), {
  alias: { '@': rootDir },
});

// Import the REAL backend modules
const { getDb } = jiti('./lib/db/index');
const { POST: createOrderRoute } = jiti('./app/api/orders/route');
const { PATCH: updateStatusRoute } = jiti('./app/api/orders/[id]/status/route');
const { eventHub } = jiti('./lib/events/eventHub');

interface TestReport {
  name: string;
  passed: boolean;
  durationMs: number;
  details: string;
  error?: string;
}

const reports: TestReport[] = [];

async function runTest(name: string, fn: () => Promise<string | void>) {
  const start = performance.now();
  process.stdout.write(`  ▶ Testing: ${name}... `);
  try {
    const details = await fn();
    const durationMs = Math.round(performance.now() - start);
    reports.push({
      name,
      passed: true,
      durationMs,
      details: details || 'Passed successfully',
    });
    console.log(`\x1b[32m✔ PASS\x1b[0m (${durationMs}ms) - ${details || ''}`);
  } catch (err: any) {
    const durationMs = Math.round(performance.now() - start);
    reports.push({
      name,
      passed: false,
      durationMs,
      details: err.message,
      error: err.stack,
    });
    console.log(`\x1b[31m✖ FAIL\x1b[0m (${durationMs}ms)`);
    console.error(`\x1b[31m    Error: ${err.message}\x1b[0m`);
    throw err;
  }
}

// Helper to make fake Next.js Request to route handler
function makeJsonRequest(url: string, body: any, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function makePatchRequest(url: string, body: any): Request {
  return new Request(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function extractResponse(res: Response) {
  const status = res.status;
  const headers = res.headers;
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status, headers, data: json, raw: text };
}

async function main() {
  console.log('\n========================================================================');
  console.log('  ADVERSARIAL STRESS TEST SUITE: M1 REAL BACKEND & IDEMPOTENCY ENGINE');
  console.log('========================================================================\n');

  const db = await getDb();

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: 10 CONCURRENT REQUESTS BURST (Same UUID)
    // ------------------------------------------------------------------------
    await runTest('10 Concurrent Burst Requests with Same UUID Key', async () => {
      const burstKey = crypto.randomUUID();
      const tableId = 'table-1';
      const orderPayload = {
        table_id: tableId,
        idempotency_key: burstKey,
        items: [
          {
            product_id: 'prod-burger-classic',
            quantity: 2,
            modifiers: [
              { modifier_id: 'mod-doneness-med' },
              { modifier_id: 'mod-extra-bacon' },
            ],
          },
        ],
      };

      // Listen for eventHub broadcast
      const broadcastEvents: any[] = [];
      const onOrderCreated = (evt: any) => {
        if (evt.payload?.order?.idempotency_key === burstKey) {
          broadcastEvents.push(evt);
        }
      };
      eventHub.on('ORDER_CREATED', onOrderCreated);

      // Fire 10 simultaneous requests
      const promises = Array.from({ length: 10 }, () =>
        createOrderRoute(makeJsonRequest('http://localhost/api/orders', orderPayload)).then(extractResponse)
      );
      const responses = await Promise.all(promises);

      eventHub.off('ORDER_CREATED', onOrderCreated);

      // Assert status codes
      const count201 = responses.filter((r) => r.status === 201).length;
      const count200 = responses.filter((r) => r.status === 200).length;

      assert.strictEqual(count201, 1, `Expected exactly 1 HTTP 201 Created, got ${count201}`);
      assert.strictEqual(count200, 9, `Expected exactly 9 HTTP 200 OK Replays, got ${count200}`);

      // Assert replay header and replayed flag on the 200s
      for (const r of responses) {
        if (r.status === 200) {
          assert.strictEqual(r.data.replayed, true, '200 response must have replayed: true');
          assert.strictEqual(r.headers.get('x-idempotent-replay'), 'true', 'Must have X-Idempotent-Replay header');
        } else {
          assert.strictEqual(r.data.replayed, false, '201 response must have replayed: false');
        }
      }

      // Assert unique order ID
      const orderIds = new Set(responses.map((r) => r.data.order.id));
      assert.strictEqual(orderIds.size, 1, `Expected 1 unique order ID across all 10 responses, got ${orderIds.size}`);
      const canonicalOrderId = responses[0].data.order.id;

      // Assert eventHub broadcast count
      assert.strictEqual(
        broadcastEvents.length,
        1,
        `Expected exactly 1 ORDER_CREATED broadcast, got ${broadcastEvents.length}`
      );

      // DIRECT DATABASE VERIFICATION
      const orderRows = await db.query('SELECT * FROM orders WHERE idempotency_key = $1', [burstKey]);
      assert.strictEqual(orderRows.rows.length, 1, `Expected 1 row in orders table, found ${orderRows.rows.length}`);

      const itemRows = await db.query('SELECT * FROM order_items WHERE order_id = $1', [canonicalOrderId]);
      assert.strictEqual(itemRows.rows.length, 1, `Expected 1 row in order_items table, found ${itemRows.rows.length}`);
      assert.strictEqual(Number(itemRows.rows[0].quantity), 2);

      const modRows = await db.query('SELECT * FROM order_item_modifiers WHERE order_item_id = $1', [itemRows.rows[0].id]);
      assert.strictEqual(modRows.rows.length, 2, `Expected 2 modifier rows, found ${modRows.rows.length}`);

      return `1x 201, 9x 200 replayed, exactly 1 order row in DB, 1 SSE event`;
    });

    // ------------------------------------------------------------------------
    // SECTION 2: 20 CONCURRENT REQUESTS BURST (High-Density Stress)
    // ------------------------------------------------------------------------
    await runTest('20 Concurrent Burst Requests with Same UUID Key', async () => {
      const burstKey = crypto.randomUUID();
      const tableId = 'table-2';
      const orderPayload = {
        table_id: tableId,
        idempotency_key: burstKey,
        items: [
          {
            product_id: 'prod-fries-rustic',
            quantity: 3,
            modifiers: [{ modifier_id: 'mod-sauce-garlic' }],
          },
        ],
      };

      const broadcastEvents: any[] = [];
      const onOrderCreated = (evt: any) => {
        if (evt.payload?.order?.idempotency_key === burstKey) {
          broadcastEvents.push(evt);
        }
      };
      eventHub.on('ORDER_CREATED', onOrderCreated);

      // Fire 20 concurrent requests
      const promises = Array.from({ length: 20 }, () =>
        createOrderRoute(makeJsonRequest('http://localhost/api/orders', orderPayload)).then(extractResponse)
      );
      const responses = await Promise.all(promises);

      eventHub.off('ORDER_CREATED', onOrderCreated);

      const count201 = responses.filter((r) => r.status === 201).length;
      const count200 = responses.filter((r) => r.status === 200).length;

      assert.strictEqual(count201, 1, `Expected exactly 1 HTTP 201, got ${count201}`);
      assert.strictEqual(count200, 19, `Expected exactly 19 HTTP 200, got ${count200}`);

      const orderIds = new Set(responses.map((r) => r.data.order.id));
      assert.strictEqual(orderIds.size, 1);
      const canonicalOrderId = responses[0].data.order.id;

      assert.strictEqual(broadcastEvents.length, 1, 'Exactly 1 SSE broadcast across 20 concurrent hits');

      // Verify DB row
      const orderDb = await db.query('SELECT count(*) as count FROM orders WHERE idempotency_key = $1', [burstKey]);
      assert.strictEqual(Number(orderDb.rows[0].count), 1);

      return `1x 201, 19x 200 replayed, exactly 1 DB comanda row, 0 event duplicates`;
    });

    // ------------------------------------------------------------------------
    // SECTION 3: REPLAY AFTER STATUS ADVANCEMENT (PENDING -> IN_PREP -> READY -> SERVED)
    // ------------------------------------------------------------------------
    await runTest('Replay Preserves Current Status When Status Advances (No Reversion)', async () => {
      const replayKey = crypto.randomUUID();
      const tableId = 'table-3';

      // 1. Initial creation (PENDING)
      const initRes = await createOrderRoute(
        makeJsonRequest('http://localhost/api/orders', {
          table_id: tableId,
          idempotency_key: replayKey,
          items: [
            {
              product_id: 'prod-burger-classic',
              quantity: 1,
              modifiers: [{ modifier_id: 'mod-doneness-34' }],
            },
          ],
        })
      ).then(extractResponse);

      assert.strictEqual(initRes.status, 201);
      const orderId = initRes.data.order.id;
      assert.strictEqual(initRes.data.order.status, 'PENDING');

      // 2. Kitchen advances status: PENDING -> IN_PREP
      const prepRes = await updateStatusRoute(
        makePatchRequest(`http://localhost/api/orders/${orderId}/status`, { status: 'IN_PREP' }),
        { params: Promise.resolve({ id: orderId }) }
      ).then(extractResponse);
      assert.strictEqual(prepRes.status, 200);
      assert.strictEqual(prepRes.data.order.status, 'IN_PREP');

      // 3. Client re-submits original order with SAME idempotency_key
      const replay1Res = await createOrderRoute(
        makeJsonRequest('http://localhost/api/orders', {
          table_id: tableId,
          idempotency_key: replayKey,
          items: [
            {
              product_id: 'prod-burger-classic',
              quantity: 1,
              modifiers: [{ modifier_id: 'mod-doneness-34' }],
            },
          ],
        })
      ).then(extractResponse);

      assert.strictEqual(replay1Res.status, 200);
      assert.strictEqual(replay1Res.data.replayed, true);
      assert.strictEqual(
        replay1Res.data.order.status,
        'IN_PREP',
        `Replay MUST NOT revert status to PENDING! Expected IN_PREP, got ${replay1Res.data.order.status}`
      );

      // Verify DB row status
      const dbCheck1 = await db.query('SELECT status FROM orders WHERE id = $1', [orderId]);
      assert.strictEqual(dbCheck1.rows[0].status, 'IN_PREP');

      // 4. Kitchen advances status: IN_PREP -> READY
      const readyRes = await updateStatusRoute(
        makePatchRequest(`http://localhost/api/orders/${orderId}/status`, { status: 'READY' }),
        { params: Promise.resolve({ id: orderId }) }
      ).then(extractResponse);
      assert.strictEqual(readyRes.status, 200);
      assert.strictEqual(readyRes.data.order.status, 'READY');

      // 5. Client re-submits again with SAME idempotency_key
      const replay2Res = await createOrderRoute(
        makeJsonRequest('http://localhost/api/orders', {
          table_id: tableId,
          idempotency_key: replayKey,
          items: [
            {
              product_id: 'prod-burger-classic',
              quantity: 1,
              modifiers: [{ modifier_id: 'mod-doneness-34' }],
            },
          ],
        })
      ).then(extractResponse);

      assert.strictEqual(replay2Res.status, 200);
      assert.strictEqual(replay2Res.data.replayed, true);
      assert.strictEqual(
        replay2Res.data.order.status,
        'READY',
        `Replay MUST NOT revert status! Expected READY, got ${replay2Res.data.order.status}`
      );

      // Verify DB row status
      const dbCheck2 = await db.query('SELECT status FROM orders WHERE id = $1', [orderId]);
      assert.strictEqual(dbCheck2.rows[0].status, 'READY');

      // 6. Kitchen advances: READY -> SERVED
      const servedRes = await updateStatusRoute(
        makePatchRequest(`http://localhost/api/orders/${orderId}/status`, { status: 'SERVED' }),
        { params: Promise.resolve({ id: orderId }) }
      ).then(extractResponse);
      assert.strictEqual(servedRes.status, 200);
      assert.strictEqual(servedRes.data.order.status, 'SERVED');

      // 7. Client re-submits after SERVED
      const replay3Res = await createOrderRoute(
        makeJsonRequest('http://localhost/api/orders', {
          table_id: tableId,
          idempotency_key: replayKey,
          items: [
            {
              product_id: 'prod-burger-classic',
              quantity: 1,
              modifiers: [{ modifier_id: 'mod-doneness-34' }],
            },
          ],
        })
      ).then(extractResponse);

      assert.strictEqual(replay3Res.status, 200);
      assert.strictEqual(replay3Res.data.replayed, true);
      assert.strictEqual(replay3Res.data.order.status, 'SERVED');

      // Direct DB verification: Total orders count for this key must remain exactly 1
      const countCheck = await db.query('SELECT count(*) as count FROM orders WHERE idempotency_key = $1', [replayKey]);
      assert.strictEqual(Number(countCheck.rows[0].count), 1);

      return `Replays at IN_PREP, READY, SERVED all preserved exact advanced statuses`;
    });

    // ------------------------------------------------------------------------
    // SECTION 4: ADVERSARIAL INPUT VALIDATION (Malformed UUIDs, Empty, Negatives)
    // ------------------------------------------------------------------------
    await runTest('Adversarial Input Validation: Malformed UUIDs, Bad Quantities, Invalid Payloads', async () => {
      const validTable = 'table-4';
      const validItems = [
        {
          product_id: 'prod-drink-lemonade',
          quantity: 1,
          modifiers: [],
        },
      ];

      // 4.1 Malformed UUID strings
      const malformedKeys = [
        'not-a-uuid',
        '12345',
        '',
        'g0000000-0000-0000-0000-000000000000', // invalid hex
        '00000000-0000-0000-0000-000000000000', // version 0 (nil)
        '550e8400-e29b-41d4-a716-446655440000-extra', // too long
        null,
      ];

      for (const badKey of malformedKeys) {
        const res = await createOrderRoute(
          makeJsonRequest('http://localhost/api/orders', {
            table_id: validTable,
            idempotency_key: badKey,
            items: validItems,
          })
        ).then(extractResponse);

        assert.strictEqual(
          res.status,
          400,
          `Expected HTTP 400 for bad UUID '${badKey}', got ${res.status}`
        );
        assert.strictEqual(res.data.success, false);
      }

      // 4.2 Empty or missing items
      const badItemsPayloads = [
        [], // empty array
        null, // null items
        undefined,
      ];

      for (const badItem of badItemsPayloads) {
        const res = await createOrderRoute(
          makeJsonRequest('http://localhost/api/orders', {
            table_id: validTable,
            idempotency_key: crypto.randomUUID(),
            items: badItem,
          })
        ).then(extractResponse);

        assert.strictEqual(res.status, 400, `Expected 400 for items=${badItem}, got ${res.status}`);
      }

      // 4.3 Negative, zero, and fractional quantities
      const badQuantities = [-1, -10, 0, 1.5, -0.5, '2', NaN];
      for (const badQty of badQuantities) {
        const res = await createOrderRoute(
          makeJsonRequest('http://localhost/api/orders', {
            table_id: validTable,
            idempotency_key: crypto.randomUUID(),
            items: [
              {
                product_id: 'prod-drink-lemonade',
                quantity: badQty,
                modifiers: [],
              },
            ],
          })
        ).then(extractResponse);

        assert.strictEqual(res.status, 400, `Expected 400 for quantity=${badQty}, got ${res.status}`);
      }

      // 4.4 Non-existent table
      const badTableRes = await createOrderRoute(
        makeJsonRequest('http://localhost/api/orders', {
          table_id: 'table-non-existent-999',
          idempotency_key: crypto.randomUUID(),
          items: validItems,
        })
      ).then(extractResponse);
      assert.strictEqual(badTableRes.status, 404, `Expected 404 for non-existent table, got ${badTableRes.status}`);

      // 4.5 Non-existent product
      const badProdRes = await createOrderRoute(
        makeJsonRequest('http://localhost/api/orders', {
          table_id: validTable,
          idempotency_key: crypto.randomUUID(),
          items: [{ product_id: 'prod-ghost-xyz', quantity: 1, modifiers: [] }],
        })
      ).then(extractResponse);
      assert.strictEqual(badProdRes.status, 400, `Expected 400 for unknown product, got ${badProdRes.status}`);

      // 4.6 Missing required modifier (Burger requires doneness min 1)
      const missingModRes = await createOrderRoute(
        makeJsonRequest('http://localhost/api/orders', {
          table_id: validTable,
          idempotency_key: crypto.randomUUID(),
          items: [{ product_id: 'prod-burger-classic', quantity: 1, modifiers: [] }],
        })
      ).then(extractResponse);
      assert.strictEqual(
        missingModRes.status,
        400,
        `Expected 400 for missing required modifier, got ${missingModRes.status}`
      );
      assert.ok(
        missingModRes.data.error.includes('requires minimum'),
        `Error message should mention minimum selection: ${missingModRes.data.error}`
      );

      // 4.7 Incompatible modifier (e.g. sauce applied to burger)
      const wrongModRes = await createOrderRoute(
        makeJsonRequest('http://localhost/api/orders', {
          table_id: validTable,
          idempotency_key: crypto.randomUUID(),
          items: [
            {
              product_id: 'prod-burger-classic',
              quantity: 1,
              modifiers: [
                { modifier_id: 'mod-doneness-med' },
                { modifier_id: 'mod-sauce-garlic' }, // garlic sauce is for rustic fries!
              ],
            },
          ],
        })
      ).then(extractResponse);
      assert.strictEqual(wrongModRes.status, 400, `Expected 400 for incompatible modifier, got ${wrongModRes.status}`);

      // 4.8 Malformed JSON syntax
      const malformedJsonReq = new Request('http://localhost/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"table_id": "table-1", INVALID_JSON',
      });
      const malformedJsonRes = await createOrderRoute(malformedJsonReq).then(extractResponse);
      assert.strictEqual(malformedJsonRes.status, 400, 'Expected 400 for malformed JSON');

      return `All 7 malformed UUIDs, 3 empty items, 7 invalid quantities, 4 relational rule violations rejected with HTTP 400/404`;
    });

    // ------------------------------------------------------------------------
    // SECTION 5: MULTI-TABLE CONCURRENT RUSH (16 Distinct Orders)
    // ------------------------------------------------------------------------
    await runTest('Multi-Table High Density Rush (16 Concurrent Orders on 8 Tables)', async () => {
      const tables = ['table-1', 'table-2', 'table-3', 'table-4', 'table-5', 'table-6', 'table-7', 'table-8'];
      const rushOrders: any[] = [];

      for (const tid of tables) {
        // 2 orders per table
        rushOrders.push({
          table_id: tid,
          idempotency_key: crypto.randomUUID(),
          items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
        });
        rushOrders.push({
          table_id: tid,
          idempotency_key: crypto.randomUUID(),
          items: [{ product_id: 'prod-fries-rustic', quantity: 1, modifiers: [{ modifier_id: 'mod-sauce-garlic' }] }],
        });
      }

      // Fire all 16 in parallel
      const promises = rushOrders.map((payload) =>
        createOrderRoute(makeJsonRequest('http://localhost/api/orders', payload)).then(extractResponse)
      );
      const responses = await Promise.all(promises);

      for (const r of responses) {
        assert.strictEqual(r.status, 201, `Expected 201 for distinct rush order, got ${r.status}`);
        assert.strictEqual(r.data.replayed, false);
      }

      const orderIds = new Set(responses.map((r) => r.data.order.id));
      assert.strictEqual(orderIds.size, 16, 'All 16 rush orders must have unique IDs');

      // Verify all 8 tables are now OCCUPIED
      const tableRows = await db.query('SELECT status FROM restaurant_tables');
      for (const row of tableRows.rows) {
        assert.strictEqual(row.status, 'OCCUPIED');
      }

      return `16 concurrent distinct orders committed without race conditions or locks`;
    });

    // Summary output
    console.log('\n========================================================================');
    console.log('                 ADVERSARIAL STRESS TEST SUMMARY');
    console.log('========================================================================');
    console.log('| # | Stress Test Scenario                                  | Time   | Status |');
    console.log('|---|-------------------------------------------------------|--------|--------|');
    reports.forEach((r, idx) => {
      const num = String(idx + 1).padEnd(2);
      const name = r.name.padEnd(54).substring(0, 54);
      const time = `${r.durationMs}ms`.padStart(6);
      const status = r.passed ? '\x1b[32mPASS\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m  ';
      console.log(`| ${num}| ${name} | ${time} | ${status} |`);
    });
    console.log('========================================================================');
    console.log('\x1b[32m✔ EMPIRICAL VERIFICATION COMPLETE — ALL ATTACK SURFACES RESILIENT\x1b[0m\n');

    process.exit(0);
  } catch (fatalError: any) {
    console.error('\n\x1b[31mADVERSARIAL SUITE ENCOUNTERED FATAL FAILURE:\x1b[0m');
    console.error(fatalError);
    process.exit(1);
  }
}

main();
