import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 2: Boundary & Corner Cases — Billing & Settlement Guards', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('1. GET /api/tables/[id]/bill for table with zero orders returns empty bill with zero totals', async () => {
    const res = await apiFetch('/api/tables/table-7/bill');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.bill.subtotal, 0);
    assert.strictEqual(res.data.bill.tax, 0);
    assert.strictEqual(res.data.bill.tip, 0);
    assert.strictEqual(res.data.bill.total, 0);
    assert.strictEqual(res.data.bill.orders_count, 0);
  });

  it('2. POST /api/tables/[id]/pay rejects cash payment when tendered_amount is less than total', async () => {
    const tableId = 'table-6';
    // Create order: 1 burger (24000)
    await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: crypto.randomUUID(),
        items: [{ product_id: 'prod-burger-classic', quantity: 1, modifiers: [{ modifier_id: 'mod-doneness-med' }] }],
      }),
    });

    const billRes = await apiFetch(`/api/tables/${tableId}/bill`);
    const total = billRes.data.bill.total;
    assert.ok(total > 0);

    // Try to pay with less cash than total
    const payRes = await apiFetch(`/api/tables/${tableId}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        payment_method: 'CASH',
        tendered_amount: total - 1000, // Insufficient cash
      }),
    });

    assert.strictEqual(payRes.status, 400);
    assert.ok(payRes.data.error.includes('less than total'));
  });

  it('3. POST /api/tables/[id]/pay rejects invalid payment method with HTTP 400', async () => {
    const tableId = 'table-6';
    const payRes = await apiFetch(`/api/tables/${tableId}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        payment_method: 'BITCOIN_UNSUPPORTED',
      }),
    });

    assert.strictEqual(payRes.status, 400);
    assert.ok(payRes.data.error.includes('payment_method'));
  });

  it('4. POST /api/tables/[id]/pay rejects double payment on already paid bill with HTTP 409 Conflict', async () => {
    const tableId = 'table-6';
    // Successful payment
    const payRes1 = await apiFetch(`/api/tables/${tableId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ payment_method: 'CREDIT_CARD' }),
    });
    assert.strictEqual(payRes1.status, 200);
    assert.strictEqual(payRes1.data.bill.status, 'PAID');

    // Attempt second payment
    const payRes2 = await apiFetch(`/api/tables/${tableId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ payment_method: 'CASH', tendered_amount: 50000 }),
    });
    assert.strictEqual(payRes2.status, 409);
    assert.ok(payRes2.data.error.includes('already paid'));
  });

  it('5. Cancelled orders are excluded from table bill calculations', async () => {
    const tableId = 'table-5';
    // Create active order (Drink: 7000)
    await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: crypto.randomUUID(),
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });

    // Create second order and cancel it (Burger: 24000)
    const orderRes = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: crypto.randomUUID(),
        items: [{ product_id: 'prod-burger-classic', quantity: 1, modifiers: [{ modifier_id: 'mod-doneness-med' }] }],
      }),
    });
    const cancelledOrderId = orderRes.data.order.id;

    await apiFetch(`/api/orders/${cancelledOrderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'CANCELLED' }),
    });

    // Check bill: should ONLY include active drink (7000), NOT cancelled burger
    const billRes = await apiFetch(`/api/tables/${tableId}/bill`);
    assert.strictEqual(billRes.data.bill.subtotal, 7000);
    assert.strictEqual(billRes.data.bill.orders_count, 1);
  });
});
