import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 2: Boundary & Corner Cases — Modifier Cardinality & Isolation', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('1. Rejects dish order when mandatory modifier group is omitted (min_selection violation)', async () => {
    // Burger requires exactly 1 doneness (min=1, max=1)
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: 'table-1',
        idempotency_key: crypto.randomUUID(),
        items: [
          {
            product_id: 'prod-burger-classic',
            quantity: 1,
            modifiers: [], // Missing required doneness modifier
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 400);
    assert.ok(res.data.error.includes('minimum 1'));
  });

  it('2. Rejects dish order when modifier group max_selection is exceeded', async () => {
    // Burger doneness allows max 1
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
              { modifier_id: 'mod-doneness-well' }, // 2 selections in single-choice group
            ],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 400);
    assert.ok(res.data.error.includes('maximum 1'));
  });

  it('3. Rejects modifier ID from an unrelated product (cross-product isolation) with HTTP 422', async () => {
    // Fries sauce modifier applied to Burger
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
              { modifier_id: 'mod-sauce-garlic' }, // Belongs to fries, not burger!
            ],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 422);
    assert.ok(res.data.error.includes('not applicable'));
  });

  it('4. Rejects modifier on a product that has no modifier groups (e.g. Lemonade) with HTTP 422', async () => {
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

    assert.strictEqual(res.status, 422);
    assert.ok(res.data.error.includes('not applicable'));
  });

  it('5. Rejects non-existent / arbitrary modifier UUID with HTTP 422', async () => {
    const fakeModId = crypto.randomUUID();
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
              { modifier_id: fakeModId },
            ],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 422);
    assert.ok(res.data.error.includes(fakeModId));
  });
});
