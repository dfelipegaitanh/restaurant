import { NextResponse } from 'next/server';
import { payTableBill } from '@/lib/db/queries';
import { eventHub } from '@/lib/events/eventHub';
import { PaymentMethod } from '@/types/domain';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Table ID is required' }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const paymentMethod: PaymentMethod = body?.payment_method;
    const tenderedAmount: number | undefined = body?.tendered_amount;

    const validMethods: PaymentMethod[] = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'SPLIT'];
    if (!paymentMethod || !validMethods.includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: `Invalid payment_method: ${paymentMethod}` },
        { status: 400 }
      );
    }

    const { bill, change_due } = await payTableBill(id, paymentMethod, tenderedAmount);

    // Broadcast PAYMENT_COMPLETED event
    eventHub.broadcast({
      type: 'PAYMENT_COMPLETED',
      payload: {
        table_id: id,
        bill_id: bill.id,
        amount: bill.total,
      },
    });

    return NextResponse.json({
      success: true,
      bill,
      change_due,
    });
  } catch (err: any) {
    console.error('Error in POST /api/tables/[id]/pay:', err);
    const message = err?.message || 'Error processing payment';
    if (message.includes('already paid')) {
      return NextResponse.json({ success: false, error: message }, { status: 409 });
    }
    if (message.includes('not found') || message.includes('Not found')) {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
