import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 2 / Integration: Idempotency Concurrency & Deduplication', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('5 concurrent burst submissions with identical idempotency_key create exactly 1 order', async () => {
    const tableId = 'table-3';
    const sharedIdempotencyKey = crypto.randomUUID();

    const orderPayload = {
      table_id: tableId,
      idempotency_key: sharedIdempotencyKey,
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

    // Simulate 5 simultaneous rapid clicks arriving in parallel within milliseconds
    const burstPromises = Array.from({ length: 5 }, () =>
      apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify(orderPayload),
      })
    );

    const responses = await Promise.all(burstPromises);

    // 1. All 5 responses must return successful HTTP status (201 Created or 200 OK Replayed)
    for (const res of responses) {
      assert.ok(
        res.status === 201 || res.status === 200,
        `Expected status 200 or 201, got ${res.status} with body: ${res.raw}`
      );
      assert.strictEqual(res.data.success, true);
      assert.ok(res.data.order, 'Response must include order details');
    }

    // 2. Exactly one response is the initial creation (201), the rest are replays (200)
    // Note: In rapid race conditions, at least one 201 occurs and the rest return 200 with replayed=true
    const statusCodes = responses.map((r) => r.status);
    const count201 = statusCodes.filter((s) => s === 201).length;
    const count200 = statusCodes.filter((s) => s === 200).length;

    assert.strictEqual(count201, 1, `Expected exactly 1 HTTP 201 Created, got ${count201}`);
    assert.strictEqual(count200, 4, `Expected exactly 4 HTTP 200 OK Replayed, got ${count200}`);

    // 3. All 5 responses must return the EXACT same order ID
    const orderIds = responses.map((r) => r.data.order.id);
    const uniqueOrderIds = new Set(orderIds);
    assert.strictEqual(
      uniqueOrderIds.size,
      1,
      `Burst produced divergent order IDs: ${Array.from(uniqueOrderIds).join(', ')}`
    );

    // 4. Verify order details integrity
    const createdOrder = responses[0].data.order;
    assert.strictEqual(createdOrder.idempotency_key, sharedIdempotencyKey);
    assert.strictEqual(createdOrder.table_id, tableId);
    assert.strictEqual(createdOrder.items.length, 1);
    assert.strictEqual(createdOrder.items[0].quantity, 2);
    assert.strictEqual(createdOrder.items[0].modifiers.length, 2);

    // Expected total derivation: (24000 base + 0 term + 4500 bacon) * 2 = 57000
    assert.strictEqual(createdOrder.total_amount, 57000);
  });

  it('sequential duplicate submission returns 200 OK with X-Idempotent-Replay header', async () => {
    const tableId = 'table-2';
    const idempotencyKey = crypto.randomUUID();

    const orderPayload = {
      table_id: tableId,
      idempotency_key: idempotencyKey,
      items: [
        {
          product_id: 'prod-fries-rustic',
          quantity: 1,
          modifiers: [{ modifier_id: 'mod-sauce-garlic' }],
        },
      ],
    };

    // First attempt: Initial creation
    const res1 = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });

    assert.strictEqual(res1.status, 201);
    assert.strictEqual(res1.data.replayed, false);
    const originalOrderId = res1.data.order.id;

    // Second attempt: Delayed duplicate retry (simulating client network retry)
    const res2 = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });

    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.headers.get('X-Idempotent-Replay'), 'true');
    assert.strictEqual(res2.data.replayed, true);
    assert.strictEqual(res2.data.order.id, originalOrderId);
  });

  it('distinct idempotency_keys create separate independent orders on same table', async () => {
    const tableId = 'table-4';
    const key1 = crypto.randomUUID();
    const key2 = crypto.randomUUID();

    const res1 = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: key1,
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });

    const res2 = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: key2,
        items: [{ product_id: 'prod-drink-lemonade', quantity: 2, modifiers: [] }],
      }),
    });

    assert.strictEqual(res1.status, 201);
    assert.strictEqual(res2.status, 201);
    assert.notStrictEqual(res1.data.order.id, res2.data.order.id);
  });
});
