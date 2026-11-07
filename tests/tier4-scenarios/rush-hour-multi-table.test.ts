import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 4: Real-World Workload Scenarios — Multi-Table Rush Hour', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('simulates 6 tables placing orders concurrently during peak dinner rush', async () => {
    const tableIds = ['table-1', 'table-2', 'table-3', 'table-4', 'table-5', 'table-6'];

    // Send 6 simultaneous order submissions from 6 separate tables
    const rushOrders = tableIds.map((tid, idx) =>
      apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: tid,
          idempotency_key: crypto.randomUUID(),
          items: [
            {
              product_id: 'prod-burger-classic',
              quantity: 1 + (idx % 2),
              modifiers: [{ modifier_id: 'mod-doneness-med' }],
            },
            {
              product_id: 'prod-fries-rustic',
              quantity: 1,
              modifiers: [{ modifier_id: 'mod-sauce-garlic' }],
            },
          ],
        }),
      })
    );

    const results = await Promise.all(rushOrders);

    // Assert all 6 orders succeeded with HTTP 201 Created
    for (const res of results) {
      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.replayed, false);
      assert.strictEqual(res.data.order.status, 'PENDING');
    }

    // Verify all 6 tables are now OCCUPIED
    const tablesRes = await apiFetch('/api/tables');
    const tableMap = new Map(tablesRes.data.tables.map((t: any) => [t.id, t.status]));

    for (const tid of tableIds) {
      assert.strictEqual(tableMap.get(tid), 'OCCUPIED', `Table ${tid} should be OCCUPIED`);
    }

    // Kitchen processes all 6 orders concurrently to IN_PREP then READY
    const advancePromises = results.map(async (res) => {
      const orderId = res.data.order.id;
      const inPrep = await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'IN_PREP' }),
      });
      assert.strictEqual(inPrep.status, 200);

      const ready = await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'READY' }),
      });
      assert.strictEqual(ready.status, 200);
      return ready.data.order;
    });

    const readyOrders = await Promise.all(advancePromises);
    assert.strictEqual(readyOrders.length, 6);
    for (const order of readyOrders) {
      assert.strictEqual(order.status, 'READY');
    }
  });
});
