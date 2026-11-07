import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  apiFetch,
  captureRealtimeEvent,
  getTestBaseUrl,
  teardownTestServer,
  resetTestState,
} from '../helpers/test-client.ts';

describe('Tier 1: Feature Coverage — Real-Time SSE Broadcasting', () => {
  before(() => {
    resetTestState();
  });

  after(async () => {
    await teardownTestServer();
  });

  it('1. GET /api/realtime sets correct SSE headers (text/event-stream)', async () => {
    const res = await apiFetch('/api/realtime', {
      headers: { Accept: 'text/event-stream' },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('text/event-stream'));
    assert.ok(res.headers.get('cache-control')?.includes('no-cache'));
  });

  it('2. Order creation broadcasts ORDER_CREATED event', async () => {
    const tableId = 'table-2';
    const ssePromise = captureRealtimeEvent(
      (e) => e.type === 'ORDER_CREATED' && e.payload.order.table_id === tableId
    );

    const orderRes = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: crypto.randomUUID(),
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });
    assert.strictEqual(orderRes.status, 201);

    const event = await ssePromise;
    assert.strictEqual(event.type, 'ORDER_CREATED');
    assert.strictEqual(event.payload.order.id, orderRes.data.order.id);
  });

  it('3. Status update broadcasts ORDER_STATUS_CHANGED event', async () => {
    const tableId = 'table-2';
    const orderRes = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId,
        idempotency_key: crypto.randomUUID(),
        items: [{ product_id: 'prod-drink-lemonade', quantity: 1, modifiers: [] }],
      }),
    });
    const orderId = orderRes.data.order.id;

    const ssePromise = captureRealtimeEvent(
      (e) => e.type === 'ORDER_STATUS_CHANGED' && e.payload.order_id === orderId
    );

    await apiFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'IN_PREP' }),
    });

    const event = await ssePromise;
    assert.strictEqual(event.type, 'ORDER_STATUS_CHANGED');
    assert.strictEqual(event.payload.old_status, 'PENDING');
    assert.strictEqual(event.payload.new_status, 'IN_PREP');
  });

  it('4. Payment completion broadcasts PAYMENT_COMPLETED event', async () => {
    const tableId = 'table-2';
    // Ensure bill is open
    await apiFetch(`/api/tables/${tableId}/bill`);

    const ssePromise = captureRealtimeEvent(
      (e) => e.type === 'PAYMENT_COMPLETED' && e.payload.table_id === tableId
    );

    await apiFetch(`/api/tables/${tableId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ payment_method: 'TRANSFER' }),
    });

    const event = await ssePromise;
    assert.strictEqual(event.type, 'PAYMENT_COMPLETED');
    assert.strictEqual(event.payload.table_id, tableId);
    assert.ok(event.payload.amount > 0);
  });

  it('5. Table release broadcasts TABLE_STATUS_CHANGED event', async () => {
    const tableId = 'table-2';
    const ssePromise = captureRealtimeEvent(
      (e) => e.type === 'TABLE_STATUS_CHANGED' && e.payload.table_id === tableId
    );

    await apiFetch(`/api/tables/${tableId}/close`, {
      method: 'POST',
    });

    const event = await ssePromise;
    assert.strictEqual(event.type, 'TABLE_STATUS_CHANGED');
    assert.strictEqual(event.payload.status, 'AVAILABLE');
  });
});
