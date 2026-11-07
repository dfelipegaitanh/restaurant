import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 1: Feature Coverage — Cashier Billing & Settlement', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('1. GET /api/tables/[id]/bill aggregates all active table orders', async () => {
    const tableId = 'table-8';
    // Order 1: 1 Burger (24000)
    await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: crypto.randomUUID(),
        items: [{ product_id: 'prod-burger-classic', quantity: 1, modifiers: [{ modifier_id: 'mod-doneness-med' }] }],
      }),
    });

    // Order 2: 1 Fries (8000)
    await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: crypto.randomUUID(),
        items: [{ product_id: 'prod-fries-rustic', quantity: 1, modifiers: [] }],
      }),
    });

    const billRes = await apiFetch(`/api/tables/${tableId}/bill`);
    assert.strictEqual(billRes.status, 200);
    assert.strictEqual(billRes.data.bill.orders_count, 2);
    assert.strictEqual(billRes.data.bill.subtotal, 32000);
  });

  it('2. Bill calculates 8% Impoconsumo tax correctly', async () => {
    const tableId = 'table-8';
    const billRes = await apiFetch(`/api/tables/${tableId}/bill`);
    // Subtotal 32.000 * 0.08 = 2.560
    assert.strictEqual(billRes.data.bill.tax, 2560);
  });

  it('3. Bill calculates 10% voluntary tip correctly', async () => {
    const tableId = 'table-8';
    const billRes = await apiFetch(`/api/tables/${tableId}/bill`);
    // Subtotal 32.000 * 0.10 = 3.200
    assert.strictEqual(billRes.data.bill.tip, 3200);
  });

  it('4. Grand total exactly matches subtotal + tax + tip', async () => {
    const tableId = 'table-8';
    const billRes = await apiFetch(`/api/tables/${tableId}/bill`);
    const { subtotal, tax, tip, total } = billRes.data.bill;
    assert.strictEqual(total, subtotal + tax + tip);
    assert.strictEqual(total, 32000 + 2560 + 3200); // 37760
  });

  it('5. POST /api/tables/[id]/pay completes payment and transitions bill status to PAID', async () => {
    const tableId = 'table-8';
    const payRes = await apiFetch(`/api/tables/${tableId}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        payment_method: 'DEBIT_CARD',
      }),
    });

    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.data.bill.status, 'PAID');
    assert.strictEqual(payRes.data.bill.payment_method, 'DEBIT_CARD');
    assert.ok(payRes.data.bill.paid_at);
  });
});
