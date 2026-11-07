import { NextResponse } from 'next/server';
import { createOrderAtomic, getKitchenOrders } from '@/lib/db/queries';
import { eventHub } from '@/lib/events/eventHub';
import { CreateOrderRequest } from '@/types/domain';

export const dynamic = 'force-dynamic';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  try {
    const orders = await getKitchenOrders();
    return NextResponse.json({ success: true, orders });
  } catch (err: any) {
    console.error('Error in GET /api/orders:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error fetching orders' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: CreateOrderRequest = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Malformed or missing JSON payload' },
        { status: 400 }
      );
    }

    const { idempotency_key, items, customer_name } = body;

    // 1. Validate idempotency_key UUID
    if (!idempotency_key || !UUID_REGEX.test(idempotency_key)) {
      return NextResponse.json(
        { success: false, error: 'Invalid or missing idempotency_key UUID v4' },
        { status: 400 }
      );
    }

    // 2. Validate items
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Order must contain at least one item' },
        { status: 400 }
      );
    }

    // 3. Atomic order ingestion
    const result = await createOrderAtomic({
      idempotency_key,
      customer_name,
      items,
    });

    // 4. Duplicate replay: return HTTP 200 with replay header, suppress event broadcast
    if (result.replayed) {
      return NextResponse.json(
        {
          success: true,
          order: result.order,
          replayed: true,
        },
        {
          status: 200,
          headers: {
            'X-Idempotent-Replay': 'true',
          },
        }
      );
    }

    // 5. New order: Broadcast ORDER_CREATED to KDS via SSE
    eventHub.broadcast({
      type: 'ORDER_CREATED',
      payload: {
        order: result.order,
      },
    });

    return NextResponse.json(
      {
        success: true,
        order: result.order,
        replayed: false,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Error in POST /api/orders:', err);
    const message = err?.message || 'Error creating order';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
