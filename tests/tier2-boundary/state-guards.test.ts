import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 2: Boundary & Corner Cases — State Machine Transition Guards', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  async function createTestOrder(): Promise<string> {
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: 'table-1',
        idempotency_key: crypto.randomUUID(),
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });
    return res.data.order.id;
  }

  it('1. Rejects illegal status jump: PENDING directly to SERVED (skipping prep/ready) with HTTP 400', async () => {
    const orderId = await createTestOrder();
    const res = await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'SERVED' }),
    });

    assert.strictEqual(res.status, 400);
    assert.ok(res.data.error.includes('Illegal state transition'));
  });

  it('2. Rejects status transition on already CANCELLED order with HTTP 400', async () => {
    const orderId = await createTestOrder();
    // Cancel order
    const cancelRes = await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert.strictEqual(cancelRes.status, 200);

    // Try to advance cancelled order to IN_PREP
    const res = await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PREP' }),
    });

    assert.strictEqual(res.status, 400);
    assert.ok(res.data.error.includes('cancelled order'));
  });

  it('3. Rejects invalid or undefined status string with HTTP 400', async () => {
    const orderId = await createTestOrder();
    const badStatuses = ['COOKING', 'DELIVERED', 'COMPLETED', '', 123, null];

    for (const bad of badStatuses) {
      const res = await apiFetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: bad }),
      });
      assert.strictEqual(res.status, 400, `Expected 400 for status ${bad}`);
    }
  });

  it('4. Idempotent transition to same status succeeds safely without corruption', async () => {
    const orderId = await createTestOrder();
    // Move to IN_PREP
    await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PREP' }),
    });

    // Send IN_PREP again (duplicate button press in kitchen)
    const res = await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PREP' }),
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.order.status, 'IN_PREP');
  });

  it('5. Double cancellation succeeds or handles idempotently without server crash', async () => {
    const orderId = await createTestOrder();
    const res1 = await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    assert.strictEqual(res1.status, 200);

    // Second cancel attempt
    const res2 = await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
    // Can be 400 (cannot transition cancelled) or 200 (idempotent), but must not 500
    assert.ok(res2.status === 400 || res2.status === 200);
  });
});
