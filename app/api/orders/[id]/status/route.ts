import { NextResponse } from 'next/server';
import { updateOrderStatus } from '@/lib/db/queries';
import { eventHub } from '@/lib/events/eventHub';
import { OrderStatus, UpdateOrderStatusRequest } from '@/types/domain';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Order ID is required' }, { status: 400 });
    }

    const body: UpdateOrderStatusRequest = await request.json().catch(() => null);
    if (!body || !body.status) {
      return NextResponse.json(
        { success: false, error: 'status field is required in request body' },
        { status: 400 }
      );
    }

    const validStatuses: OrderStatus[] = ['PENDING', 'IN_PREP', 'READY', 'SERVED', 'CANCELLED'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status: ${body.status}` },
        { status: 400 }
      );
    }

    const { order, oldStatus } = await updateOrderStatus(id, body.status);

    // Broadcast ORDER_STATUS_CHANGED event
    eventHub.broadcast({
      type: 'ORDER_STATUS_CHANGED',
      payload: {
        order_id: order.id,
        table_id: order.table_id,
        old_status: oldStatus,
        new_status: body.status,
        updated_at: order.updated_at,
      },
    });

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (err: any) {
    console.error('Error in PATCH /api/orders/[id]/status:', err);
    const message = err?.message || 'Error updating order status';
    if (message.includes('not found') || message.includes('Not found')) {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
