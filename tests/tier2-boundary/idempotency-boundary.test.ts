import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 2: Boundary & Corner Cases — Idempotency Constraints', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('1. Replay with identical key preserves existing order and returns HTTP 200 replayed=true', async () => {
    const tableId = 'table-1';
    const key = crypto.randomUUID();

    const first = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: key,
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });
    assert.strictEqual(first.status, 201);
    assert.strictEqual(first.data.replayed, false);

    const replay = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: key,
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });
    assert.strictEqual(replay.status, 200);
    assert.strictEqual(replay.data.replayed, true);
    assert.strictEqual(replay.headers.get('X-Idempotent-Replay'), 'true');
    assert.strictEqual(replay.data.order.id, first.data.order.id);
  });

  it('2. Replay with identical key but different body returns the original order (idempotency key lock)', async () => {
    const tableId = 'table-1';
    const key = crypto.randomUUID();

    const first = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: key,
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });
    assert.strictEqual(first.status, 201);
    const originalId = first.data.order.id;

    // Second attempt sends different items with the same idempotency key (malicious replay or bug)
    const replay = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: key,
        items: [{ product_id: 'prod-burger-classic', quantity: 5, modifiers: [] }],
      }),
    });
    assert.strictEqual(replay.status, 200);
    assert.strictEqual(replay.data.replayed, true);
    assert.strictEqual(replay.data.order.id, originalId);
    // Verifies original items remained untouched
    assert.strictEqual(replay.data.order.items[0].product_id, 'prod-drink-lemonade');
  });

  it('3. Replaying an order that has transitioned to IN_PREP returns the current status', async () => {
    const tableId = 'table-2';
    const key = crypto.randomUUID();

    const first = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: key,
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });
    const orderId = first.data.order.id;

    // Kitchen advances order to IN_PREP
    await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PREP' }),
    });

    // Client re-sends the same order due to late connection
    const replay = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: key,
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });

    assert.strictEqual(replay.status, 200);
    assert.strictEqual(replay.data.replayed, true);
    // Status should NOT reset to PENDING; it must remain IN_PREP
    assert.strictEqual(replay.data.order.status, 'IN_PREP');
  });

  it('4. Sequential rapid re-submissions do not duplicate items count or totals', async () => {
    const tableId = 'table-3';
    const key = crypto.randomUUID();

    const initial = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: key,
        items: [{ product_id: 'prod-fries-rustic', quantity: 2, modifiers: [] }],
      }),
    });
    assert.strictEqual(initial.status, 201);
    const expectedTotal = initial.data.order.total_amount;

    for (let i = 0; i < 3; i++) {
      const replay = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: tableId,
          idempotency_key: key,
          items: [{ product_id: 'prod-fries-rustic', quantity: 2, modifiers: [] }],
        }),
      });
      assert.strictEqual(replay.status, 200);
      assert.strictEqual(replay.data.order.items.length, 1);
      assert.strictEqual(replay.data.order.total_amount, expectedTotal);
    }
  });

  it('5. Distinct idempotency keys for identical table and items create distinct orders', async () => {
    const tableId = 'table-4';
    const keyA = crypto.randomUUID();
    const keyB = crypto.randomUUID();

    const orderA = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: keyA,
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });

    const orderB = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: keyB,
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });

    assert.strictEqual(orderA.status, 201);
    assert.strictEqual(orderB.status, 201);
    assert.notStrictEqual(orderA.data.order.id, orderB.data.order.id);
  });
});
