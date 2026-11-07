import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { apiFetch, teardownTestServer, resetTestState } from '../helpers/test-client.ts';

describe('Tier 4: Real-World Workload Scenarios — Cash Settlement & Change Calculation', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('calculates precise cash change due and records payment timestamp for cashier register', async () => {
    const tableId = 'table-2';

    // Order: 1 Burger with Bacon (28.500)
    await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: crypto.randomUUID(),
        items: [
          {
            product_id: 'prod-burger-classic',
            quantity: 1,
            modifiers: [{ modifier_id: 'mod-doneness-med' }, { modifier_id: 'mod-extra-bacon' }],
          },
        ],
      }),
    });

    const billRes = await apiFetch(`/api/tables/${tableId}/bill`);
    const bill = billRes.data.bill;
    assert.strictEqual(bill.subtotal, 28500);
    // Tax: 2.280, Tip: 2.850, Total: 33.630
    assert.strictEqual(bill.total, 33630);

    // Customer hands a 50.000 COP bill to Cashier
    const cashTendered = 50000;
    const payRes = await apiFetch(`/api/tables/${tableId}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        payment_method: 'CASH',
        tendered_amount: cashTendered,
      }),
    });

    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.data.success, true);
    assert.strictEqual(payRes.data.bill.status, 'PAID');
    assert.strictEqual(payRes.data.bill.payment_method, 'CASH');

    // Expected Change: 50.000 - 33.630 = 16.370
    assert.strictEqual(payRes.data.change_due, 16370);
    assert.ok(payRes.data.bill.paid_at, 'Must have recorded paid_at timestamp');
  });
});
