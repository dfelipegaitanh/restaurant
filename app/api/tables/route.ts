import { NextResponse } from 'next/server';
import { getTables } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tables = await getTables();
    return NextResponse.json({
      success: true,
      tables,
    });
  } catch (err: any) {
    console.error('Error in GET /api/tables:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error fetching tables' },
      { status: 500 }
    );
  }
}
