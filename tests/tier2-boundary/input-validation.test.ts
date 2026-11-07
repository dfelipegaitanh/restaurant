import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 2: Boundary & Corner Cases — Input Validation & Sanitization', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('1. Rejects invalid or malformed idempotency_key UUID formats with HTTP 400', async () => {
    const invalidKeys = [
      '',
      'not-a-uuid',
      '12345',
      'f47ac10b-58cc-4372-a567', // truncated
      'g47ac10b-58cc-4372-a567-0e02b2c3d479', // non-hex 'g'
      '../../../etc/passwd', // path traversal injection attempt
    ];

    for (const badKey of invalidKeys) {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: 'table-1',
          idempotency_key: badKey,
          items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
        }),
      });
      assert.strictEqual(res.status, 400, `Expected 400 for key: ${badKey}, got ${res.status}`);
      assert.ok(res.data.error.includes('idempotency_key'));
    }
  });

  it('2. Rejects orders with empty items array with HTTP 400', async () => {
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: 'table-1',
        idempotency_key: crypto.randomUUID(),
        items: [],
      }),
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.error.includes('at least one item'));
  });

  it('3. Rejects items with non-positive or non-integer quantities (0, -1, 1.5) with HTTP 400', async () => {
    const invalidQuantities = [0, -1, -99, 1.5, NaN, 'two'];

    for (const qty of invalidQuantities) {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          table_id: 'table-1',
          idempotency_key: crypto.randomUUID(),
          items: [{ product_id: 'prod-drink-lemonade', quantity: qty, modifiers: [] }],
        }),
      });
      assert.strictEqual(res.status, 400, `Expected 400 for qty: ${qty}`);
      assert.ok(res.data.error.includes('quantity'));
    }
  });

  it('4. Rejects orders with non-existent table_id with HTTP 404', async () => {
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: 'table-999-invalid',
        idempotency_key: crypto.randomUUID(),
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });
    assert.strictEqual(res.status, 404);
    assert.ok(res.data.error.includes('table'));
  });

  it('5. Rejects orders with non-existent product_id with HTTP 400', async () => {
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: 'table-1',
        idempotency_key: crypto.randomUUID(),
        items: [{ product_id: 'prod-ghost-dish', quantity: 1, modifiers: [] }],
      }),
    });
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.error.includes('product_id'));
  });
});
