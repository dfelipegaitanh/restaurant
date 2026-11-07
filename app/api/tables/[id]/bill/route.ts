import { NextResponse } from 'next/server';
import { getTableBill } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Table ID is required' }, { status: 400 });
    }

    const bill = await getTableBill(id);
    return NextResponse.json({
      success: true,
      bill,
    });
  } catch (err: any) {
    console.error('Error in GET /api/tables/[id]/bill:', err);
    const message = err?.message || 'Error fetching table bill';
    if (message.includes('not found') || message.includes('Not found')) {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
