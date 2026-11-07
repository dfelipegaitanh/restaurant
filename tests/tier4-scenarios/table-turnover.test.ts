import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 4: Real-World Workload Scenarios — Table Turnover & Session Lifecycle', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('completes party 1 dining cycle, frees table, and confirms party 2 starts with zero leftover orders', async () => {
    const tableId = 'table-8';

    // === Party 1 Arrives & Orders ===
    const party1Key = crypto.randomUUID();
    const party1Order = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: party1Key,
        items: [{ product_id: 'prod-fries-rustic', quantity: 2, modifiers: [] }],
      }),
    });
    assert.strictEqual(party1Order.status, 201);
    const party1Total = party1Order.data.order.total_amount; // 16.000

    // Party 1 Bill & Payment
    const bill1 = await apiFetch(`/api/tables/${tableId}/bill`);
    assert.strictEqual(bill1.data.bill.subtotal, party1Total);

    const pay1 = await apiFetch(`/api/tables/${tableId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ payment_method: 'CASH', tendered_amount: 30000 }),
    });
    assert.strictEqual(pay1.status, 200);

    // Party 1 Leaves -> Table Released to AVAILABLE
    const close1 = await apiFetch(`/api/tables/${tableId}/close`, { method: 'POST' });
    assert.strictEqual(close1.status, 200);
    assert.strictEqual(close1.data.status, 'AVAILABLE');

    // === Party 2 Arrives at Table 8 ===
    // Verify initial clean bill for new party
    const cleanBill = await apiFetch(`/api/tables/${tableId}/bill`);
    assert.strictEqual(cleanBill.data.bill.orders_count, 0, 'New session must have 0 orders');
    assert.strictEqual(cleanBill.data.bill.subtotal, 0, 'New session must start with $0 subtotal');

    // Party 2 places their own order (1 Lemonade = 7.000)
    const party2Key = crypto.randomUUID();
    const party2Order = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: party2Key,
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });
    assert.strictEqual(party2Order.status, 201);

    // Verify Party 2 bill does not leak Party 1 fries
    const bill2 = await apiFetch(`/api/tables/${tableId}/bill`);
    assert.strictEqual(bill2.data.bill.orders_count, 1);
    assert.strictEqual(bill2.data.bill.subtotal, 7000);
  });
});
