import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 1: Feature Coverage — Restaurant Tables Management', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('1. GET /api/tables lists all 8 restaurant tables', async () => {
    const res = await apiFetch('/api/tables');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.tables.length, 8, 'Must return exactly 8 configured tables');
  });

  it('2. Tables have valid initial status AVAILABLE', async () => {
    const res = await apiFetch('/api/tables');
    for (const table of res.data.tables) {
      assert.strictEqual(table.status, 'AVAILABLE');
    }
  });

  it('3. Every table declares a positive integer seating capacity', async () => {
    const res = await apiFetch('/api/tables');
    for (const table of res.data.tables) {
      assert.strictEqual(typeof table.capacity, 'number');
      assert.ok(table.capacity >= 2, `Table ${table.id} capacity must be >= 2`);
    }
  });

  it('4. Table status automatically transitions to OCCUPIED when an order is submitted', async () => {
    const tableId = 'table-1';
    const key = crypto.randomUUID();

    const orderRes = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: key,
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });
    assert.strictEqual(orderRes.status, 201);

    const tablesRes = await apiFetch('/api/tables');
    const table = tablesRes.data.tables.find((t: any) => t.id === tableId);
    assert.strictEqual(table.status, 'OCCUPIED');
    assert.ok(table.active_orders.includes(orderRes.data.order.id));
  });

  it('5. POST /api/tables/[id]/close resets table status back to AVAILABLE', async () => {
    const tableId = 'table-1';
    const closeRes = await apiFetch(`/api/tables/${tableId}/close`, {
      method: 'POST',
    });
    assert.strictEqual(closeRes.status, 200);
    assert.strictEqual(closeRes.data.status, 'AVAILABLE');

    const tablesRes = await apiFetch('/api/tables');
    const table = tablesRes.data.tables.find((t: any) => t.id === tableId);
    assert.strictEqual(table.status, 'AVAILABLE');
  });
});
