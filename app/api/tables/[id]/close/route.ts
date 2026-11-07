import { NextResponse } from 'next/server';
import { closeTable } from '@/lib/db/queries';
import { eventHub } from '@/lib/events/eventHub';

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

    await closeTable(id);

    // Broadcast TABLE_STATUS_CHANGED event
    eventHub.broadcast({
      type: 'TABLE_STATUS_CHANGED',
      payload: {
        table_id: id,
        status: 'AVAILABLE',
      },
    });

    return NextResponse.json({
      success: true,
      table_id: id,
      status: 'AVAILABLE',
    });
  } catch (err: any) {
    console.error('Error in POST /api/tables/[id]/close:', err);
    const message = err?.message || 'Error closing table';
    if (message.includes('not found') || message.includes('Not found')) {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
