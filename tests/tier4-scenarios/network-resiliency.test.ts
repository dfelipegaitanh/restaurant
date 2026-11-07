import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 4: Real-World Workload Scenarios — Network Resiliency & Client Retry', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('recovers cleanly from simulated client network timeout and re-syncs state using cached idempotency_key', async () => {
    const tableId = 'table-7';
    // Tablet generates idempotency key and caches in client state / localStorage
    const cachedClientKey = crypto.randomUUID();

    const orderPayload = {
      table_id: tableId,
      idempotency_key: cachedClientKey,
      items: [
        {
          product_id: 'prod-burger-classic',
          quantity: 1,
          modifiers: [{ modifier_id: 'mod-doneness-34' }, { modifier_id: 'mod-extra-bacon' }],
        },
      ],
    };

    // First attempt reaches the server and succeeds
    const initialRes = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });
    assert.strictEqual(initialRes.status, 201);
    const serverOrderId = initialRes.data.order.id;

    // Simulate tablet encountering client-side timeout / flaky Wi-Fi ACK failure:
    // Client consults localStorage, retrieves cachedClientKey, and retries the order request
    const retryRes = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });

    // Server must respond with 200 OK and replay flag, matching original order ID
    assert.strictEqual(retryRes.status, 200);
    assert.strictEqual(retryRes.data.replayed, true);
    assert.strictEqual(retryRes.data.order.id, serverOrderId);

    // Assert that table bill has only 1 comanda total (no double bill)
    const billRes = await apiFetch(`/api/tables/${tableId}/bill`);
    assert.strictEqual(billRes.data.bill.orders_count, 1);
    assert.strictEqual(billRes.data.bill.subtotal, 28500);
  });
});
