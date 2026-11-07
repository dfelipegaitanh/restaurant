import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  apiFetch,
  captureRealtimeEvent,
  teardownTestServer,
  resetTestState,
} from '../helpers/test-client.ts';

describe('Tier 3 / E2E: Full Restaurant Ordering & Lifecycle Flow', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('executes full flow: Table Order -> SSE KDS Receive -> Kitchen Prep -> Cashier Billing & Settlement', async () => {
    const tableId = 'table-3';
    const idempotencyKey = crypto.randomUUID();

    // 1. Verify table initial status is AVAILABLE
    const tablesRes = await apiFetch('/api/tables');
    assert.strictEqual(tablesRes.status, 200);
    const tableObj = tablesRes.data.tables.find((t: any) => t.id === tableId);
    assert.ok(tableObj, `Table ${tableId} must exist`);
    assert.strictEqual(tableObj.status, 'AVAILABLE');

    // 2. Prepare SSE listener for incoming comanda
    const sseCreatedPromise = captureRealtimeEvent(
      (e) => e.type === 'ORDER_CREATED' && e.payload.order.table_id === tableId
    );

    // 3. Customer at Table 3 submits order with relational modifiers:
    // "Hamburguesa Clásica Bogotana" (24000) + "Término Medio" (0) + "Extra Tocineta Ahumada" (4500) = 28500
    const orderPayload = {
      table_id: tableId,
      idempotency_key: idempotencyKey,
      items: [
        {
          product_id: 'prod-burger-classic',
          quantity: 1,
          modifiers: [
            { modifier_id: 'mod-doneness-med' },
            { modifier_id: 'mod-extra-bacon' },
          ],
        },
      ],
    };

    const orderRes = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });

    assert.strictEqual(orderRes.status, 201, `Failed to create order: ${orderRes.raw}`);
    assert.strictEqual(orderRes.data.success, true);
    assert.strictEqual(orderRes.data.replayed, false);

    const order = orderRes.data.order;
    assert.ok(order.id);
    assert.strictEqual(order.status, 'PENDING');
    assert.strictEqual(order.total_amount, 28500);
    assert.strictEqual(order.items.length, 1);
    assert.strictEqual(order.items[0].modifiers.length, 2);

    // 4. Verify Kitchen Display System receives ORDER_CREATED event over SSE
    const createdEvent = await sseCreatedPromise;
    assert.strictEqual(createdEvent.type, 'ORDER_CREATED');
    assert.strictEqual(createdEvent.payload.order.id, order.id);
    assert.strictEqual(createdEvent.payload.order.table_id, tableId);

    // 5. Kitchen Chef accepts ticket and starts preparation: PENDING -> IN_PREP
    const sseInPrepPromise = captureRealtimeEvent(
      (e) => e.type === 'ORDER_STATUS_CHANGED' && e.payload.order_id === order.id && e.payload.new_status === 'IN_PREP'
    );

    const inPrepRes = await apiFetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PREP' }),
    });
    assert.strictEqual(inPrepRes.status, 200);
    assert.strictEqual(inPrepRes.data.order.status, 'IN_PREP');

    const inPrepEvent = await sseInPrepPromise;
    assert.strictEqual(inPrepEvent.payload.new_status, 'IN_PREP');

    // 6. Kitchen Chef finishes cooking: IN_PREP -> READY
    const sseReadyPromise = captureRealtimeEvent(
      (e) => e.type === 'ORDER_STATUS_CHANGED' && e.payload.order_id === order.id && e.payload.new_status === 'READY'
    );

    const readyRes = await apiFetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'READY' }),
    });
    assert.strictEqual(readyRes.status, 200);
    assert.strictEqual(readyRes.data.order.status, 'READY');

    const readyEvent = await sseReadyPromise;
    assert.strictEqual(readyEvent.payload.new_status, 'READY');

    // 7. Waiter serves order to table: READY -> SERVED
    const servedRes = await apiFetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'SERVED' }),
    });
    assert.strictEqual(servedRes.status, 200);
    assert.strictEqual(servedRes.data.order.status, 'SERVED');

    // 8. Cashier queries bill for Table 3
    const billRes = await apiFetch(`/api/tables/${tableId}/bill`);
    assert.strictEqual(billRes.status, 200);
    assert.strictEqual(billRes.data.success, true);

    const bill = billRes.data.bill;
    assert.strictEqual(bill.table_id, tableId);
    assert.strictEqual(bill.subtotal, 28500);

    // Mathematical verification:
    // Subtotal: 28.500
    // Tax (8% Impoconsumo): 28.500 * 0.08 = 2.280
    // Tip (10% voluntary): 28.500 * 0.10 = 2.850
    // Grand Total: 28.500 + 2.280 + 2.850 = 33.630
    assert.strictEqual(bill.tax, 2280);
    assert.strictEqual(bill.tip, 2850);
    assert.strictEqual(bill.total, 33630);
    assert.strictEqual(bill.status, 'OPEN');

    // 9. Cashier processes Cash payment of 50.000 COP
    const ssePaymentPromise = captureRealtimeEvent(
      (e) => e.type === 'PAYMENT_COMPLETED' && e.payload.table_id === tableId
    );

    const payRes = await apiFetch(`/api/tables/${tableId}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        payment_method: 'CASH',
        tendered_amount: 50000,
      }),
    });

    assert.strictEqual(payRes.status, 200);
    assert.strictEqual(payRes.data.success, true);
    assert.strictEqual(payRes.data.bill.status, 'PAID');
    // Change due: 50.000 - 33.630 = 16.370
    assert.strictEqual(payRes.data.change_due, 16370);

    const paymentEvent = await ssePaymentPromise;
    assert.strictEqual(paymentEvent.payload.amount, 33630);

    // 10. Cashier closes and releases Table 3
    const sseClosePromise = captureRealtimeEvent(
      (e) => e.type === 'TABLE_STATUS_CHANGED' && e.payload.table_id === tableId && e.payload.status === 'AVAILABLE'
    );

    const closeRes = await apiFetch(`/api/tables/${tableId}/close`, {
      method: 'POST',
    });
    assert.strictEqual(closeRes.status, 200);
    assert.strictEqual(closeRes.data.status, 'AVAILABLE');

    const closeEvent = await sseClosePromise;
    assert.strictEqual(closeEvent.payload.status, 'AVAILABLE');

    // 11. Final verification: Table status in table list is AVAILABLE
    const finalTablesRes = await apiFetch('/api/tables');
    const finalTableObj = finalTablesRes.data.tables.find((t: any) => t.id === tableId);
    assert.strictEqual(finalTableObj.status, 'AVAILABLE');
  });
});
