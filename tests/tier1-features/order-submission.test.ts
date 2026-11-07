import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 1: Feature Coverage — Order Ingestion & Relational Modifiers', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('1. POST /api/orders with valid payload returns HTTP 201 Created and order summary', async () => {
    const key = crypto.randomUUID();
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: 'table-5',
        idempotency_key: key,
        items: [
          {
            product_id: 'prod-burger-classic',
            quantity: 1,
            modifiers: [{ modifier_id: 'mod-doneness-34' }],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.replayed, false);
    assert.strictEqual(res.data.order.status, 'PENDING');
    assert.strictEqual(res.data.order.table_id, 'table-5');
    assert.strictEqual(res.data.order.idempotency_key, key);
  });

  it('2. Order persists relational modifier selections linked to order items', async () => {
    const key = crypto.randomUUID();
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: 'table-5',
        idempotency_key: key,
        items: [
          {
            product_id: 'prod-burger-classic',
            quantity: 1,
            modifiers: [
              { modifier_id: 'mod-doneness-well' },
              { modifier_id: 'mod-extra-bacon' },
              { modifier_id: 'mod-no-onion' },
            ],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 201);
    const item = res.data.order.items[0];
    assert.strictEqual(item.modifiers.length, 3);

    const modActions = item.modifiers.map((m: any) => m.action_type);
    assert.ok(modActions.includes('OPTION')); // well done
    assert.ok(modActions.includes('EXTRA')); // bacon
    assert.ok(modActions.includes('NO')); // no onion
  });

  it('3. Order calculation correctly sums dish base price and modifier deltas', async () => {
    const key = crypto.randomUUID();
    // Base 24.000 + Well Done (0) + Bacon (4.500) + Extra Cheddar (3.500) = 32.000
    // Quantity: 2 => 64.000
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: 'table-6',
        idempotency_key: key,
        items: [
          {
            product_id: 'prod-burger-classic',
            quantity: 2,
            modifiers: [
              { modifier_id: 'mod-doneness-well' },
              { modifier_id: 'mod-extra-bacon' },
              { modifier_id: 'mod-extra-cheese' },
            ],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.order.total_amount, 64000);
  });

  it('4. Multi-item order correctly calculates composite line items and total', async () => {
    const key = crypto.randomUUID();
    // Burger: (24.000 + 0) * 1 = 24.000
    // Fries: (8.000 + 1.500 garlic) * 2 = 19.000
    // Drink: 7.000 * 2 = 14.000
    // Total = 24.000 + 19.000 + 14.000 = 57.000
    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: 'table-6',
        idempotency_key: key,
        items: [
          {
            product_id: 'prod-burger-classic',
            quantity: 1,
            modifiers: [{ modifier_id: 'mod-doneness-med' }],
          },
          {
            product_id: 'prod-fries-rustic',
            quantity: 2,
            modifiers: [{ modifier_id: 'mod-sauce-garlic' }],
          },
          {
            product_id: 'prod-drink-lemonade',
            quantity: 2,
            modifiers: [],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.order.items.length, 3);
    assert.strictEqual(res.data.order.total_amount, 57000);
  });

  it('5. Each order receives a sequential human-readable order_number for the kitchen', async () => {
    const key1 = crypto.randomUUID();
    const key2 = crypto.randomUUID();

    const res1 = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: 'table-2',
        idempotency_key: key1,
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });

    const res2 = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: 'table-2',
        idempotency_key: key2,
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });

    assert.ok(typeof res1.data.order.order_number === 'number');
    assert.ok(typeof res2.data.order.order_number === 'number');
    assert.strictEqual(res2.data.order.order_number, res1.data.order.order_number + 1);
  });
});
