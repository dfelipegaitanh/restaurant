import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  apiFetch,
  captureRealtimeEvent,
  teardownTestServer,
  resetTestState,
} from '../helpers/test-client.ts';

describe('Tier 3: Cross-Feature Interactions — Multi-Round Ordering & Kitchen Flow', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('handles multi-round ordering on Table 4 with sequential KDS tickets and consolidated bill', async () => {
    const tableId = 'table-4';

    // Round 1: Drinks & Starters (2 Lemonades = 14.000 + 1 Rustic Fries with Garlic = 9.500) = 23.500
    const keyRound1 = crypto.randomUUID();
    const sseRound1Promise = captureRealtimeEvent(
      (e) => e.type === 'ORDER_CREATED' && e.payload.order.table_id === tableId
    );

    const round1Res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: keyRound1,
        items: [
          { product_id: 'prod-drink-lemonade', quantity: 2, modifiers: [] },
          { product_id: 'prod-fries-rustic', quantity: 1, modifiers: [{ modifier_id: 'mod-sauce-garlic' }] },
        ],
      }),
    });

    assert.strictEqual(round1Res.status, 201);
    const order1 = round1Res.data.order;
    assert.strictEqual(order1.total_amount, 23500);

    const event1 = await sseRound1Promise;
    assert.strictEqual(event1.payload.order.id, order1.id);

    // Kitchen starts and completes Round 1
    await apiFetch(`/api/orders/${order1.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PREP' }),
    });
    await apiFetch(`/api/orders/${order1.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'READY' }),
    });
    await apiFetch(`/api/orders/${order1.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'SERVED' }),
    });

    // Round 2: Main Dishes (2 Classic Burgers with Bacon & Cheddar = (24000 + 4500 + 3500) * 2 = 64.000)
    const keyRound2 = crypto.randomUUID();
    const sseRound2Promise = captureRealtimeEvent(
      (e) => e.type === 'ORDER_CREATED' && e.payload.order.table_id === tableId && e.payload.order.id !== order1.id
    );

    const round2Res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: keyRound2,
        items: [
          {
            product_id: 'prod-burger-classic',
            quantity: 2,
            modifiers: [
              { modifier_id: 'mod-doneness-34' },
              { modifier_id: 'mod-extra-bacon' },
              { modifier_id: 'mod-extra-cheese' },
            ],
          },
        ],
      }),
    });

    assert.strictEqual(round2Res.status, 201);
    const order2 = round2Res.data.order;
    assert.strictEqual(order2.total_amount, 64000);

    const event2 = await sseRound2Promise;
    assert.strictEqual(event2.payload.order.id, order2.id);

    // Advance Round 2 to SERVED
    await apiFetch(`/api/orders/${order2.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PREP' }),
    });
    await apiFetch(`/api/orders/${order2.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'SERVED' }),
    });

    // Cashier requests consolidated bill for Table 4
    const billRes = await apiFetch(`/api/tables/${tableId}/bill`);
    assert.strictEqual(billRes.status, 200);

    const bill = billRes.data.bill;
    assert.strictEqual(bill.orders_count, 2);
    // Combined subtotal = 23.500 + 64.000 = 87.500
    assert.strictEqual(bill.subtotal, 87500);

    // Tax (8% of 87.500) = 7.000
    assert.strictEqual(bill.tax, 7000);
    // Tip (10% of 87.500) = 8.750
    assert.strictEqual(bill.tip, 8750);
    // Total = 87.500 + 7.000 + 8.750 = 103.250
    assert.strictEqual(bill.total, 103250);

    // Cashier settles Table 4
    const payRes = await apiFetch(`/api/tables/${tableId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ payment_method: 'CREDIT_CARD' }),
    });
    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.data.bill.status, 'PAID');

    // Table release
    const closeRes = await apiFetch(`/api/tables/${tableId}/close`, {
      method: 'POST',
    });
    assert.strictEqual(closeRes.status, 200);
    assert.strictEqual(closeRes.data.status, 'AVAILABLE');
  });
});
