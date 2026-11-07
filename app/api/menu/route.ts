import { NextResponse } from 'next/server';
import { getMenu } from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { categories, products } = await getMenu();
    return NextResponse.json({
      success: true,
      categories,
      products,
    });
  } catch (err: any) {
    console.error('Error in GET /api/menu:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Error fetching menu' },
      { status: 500 }
    );
  }
}
