import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 3: Cross-Feature Interactions — Modifiers Pricing & Snapshot Integrity', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('validates exact mathematical integrity with multiple diverse modifier configurations in one order', async () => {
    const tableId = 'table-5';

    // Order contains 3 dishes with varied modifier types:
    // Dish 1: Classic Burger (24000) + Med Doneness (0) + Extra Bacon (4500) + No Onion (0) = 28.500 * 1 = 28.500
    // Dish 2: Classic Burger (24000) + Well Done (0) + Extra Bacon (4500) + Extra Cheese (3500) = 32.000 * 2 = 64.000
    // Dish 3: Rustic Fries (8000) + Garlic Sauce (1500) + BBQ Sauce (1500) = 11.000 * 3 = 33.000
    // Total Order Expected = 28.500 + 64.000 + 33.000 = 125.500

    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: crypto.randomUUID(),
        items: [
          {
            product_id: 'prod-burger-classic',
            quantity: 1,
            modifiers: [
              { modifier_id: 'mod-doneness-med' },
              { modifier_id: 'mod-extra-bacon' },
              { modifier_id: 'mod-no-onion' },
            ],
          },
          {
            product_id: 'prod-burger-classic',
            quantity: 2,
            modifiers: [
              { modifier_id: 'mod-doneness-well' },
              { modifier_id: 'mod-extra-bacon' },
              { modifier_id: 'mod-extra-cheese' },
            ],
          },
          {
            product_id: 'prod-fries-rustic',
            quantity: 3,
            modifiers: [
              { modifier_id: 'mod-sauce-garlic' },
              { modifier_id: 'mod-sauce-bbq' },
            ],
          },
        ],
      }),
    });

    assert.strictEqual(res.status, 201);
    const order = res.data.order;
    assert.strictEqual(order.items.length, 3);

    // Verify Dish 1 line subtotal
    assert.strictEqual(order.items[0].subtotal, 28500);
    // Verify Dish 2 line subtotal
    assert.strictEqual(order.items[1].subtotal, 64000);
    // Verify Dish 3 line subtotal
    assert.strictEqual(order.items[2].subtotal, 33000);

    // Verify Order total amount
    assert.strictEqual(order.total_amount, 125500);

    // Verify Cashier bill math
    const billRes = await apiFetch(`/api/tables/${tableId}/bill`);
    const bill = billRes.data.bill;
    assert.strictEqual(bill.subtotal, 125500);

    // Tax 8%: 125500 * 0.08 = 10040
    assert.strictEqual(bill.tax, 10040);
    // Tip 10%: 125500 * 0.10 = 12550
    assert.strictEqual(bill.tip, 12550);
    // Total: 125500 + 10040 + 12550 = 148090
    assert.strictEqual(bill.total, 148090);
  });
});
