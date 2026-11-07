import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 1: Feature Coverage — Kitchen KDS Status Transitions', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  async function createTestOrder(tableId = 'table-7'): Promise<string> {
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: crypto.randomUUID(),
        items: [{ product_id: 'prod-fries-rustic', quantity: 1, modifiers: [] }],
      }),
    });
    return res.data.order.id;
  }

  it('1. Transition from PENDING to IN_PREP succeeds with HTTP 200', async () => {
    const orderId = await createTestOrder();
    const res = await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PREP' }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.order.status, 'IN_PREP');
  });

  it('2. Transition from IN_PREP to READY succeeds with HTTP 200', async () => {
    const orderId = await createTestOrder();
    await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PREP' }),
    });

    const res = await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'READY' }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.order.status, 'READY');
  });

  it('3. Transition from READY to SERVED succeeds with HTTP 200', async () => {
    const orderId = await createTestOrder();
    await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PREP' }),
    });
    await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'READY' }),
    });

    const res = await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'SERVED' }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.order.status, 'SERVED');
  });

  it('4. Cancellation from PENDING to CANCELLED succeeds with HTTP 200', async () => {
    const orderId = await createTestOrder();
    const res = await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.order.status, 'CANCELLED');
  });

  it('5. Status update on non-existent order ID returns HTTP 404 Not Found', async () => {
    const nonExistentId = crypto.randomUUID();
    const res = await apiFetch(`/api/orders/${nonExistentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PREP' }),
    });
    assert.strictEqual(res.status, 404);
  });
});
