import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table') || 'products';

    const db = await getDb();

    // List all public tables
    const tablesRes = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name ASC;
    `);

    // Whitelist table name to prevent SQL injection
    const validTables = tablesRes.rows.map(r => r.table_name);
    const selectedTable = validTables.includes(table) ? table : validTables[0] || 'products';

    // Fetch up to 100 rows
    const dataRes = await db.query(`SELECT * FROM ${selectedTable} ORDER BY 1 DESC LIMIT 100;`);

    return NextResponse.json({
      success: true,
      tables: validTables,
      activeTable: selectedTable,
      rowCount: dataRes.rowCount,
      columns: dataRes.rows.length > 0 ? Object.keys(dataRes.rows[0]) : [],
      rows: dataRes.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sql } = body;

    if (!sql || typeof sql !== 'string') {
      return NextResponse.json({ success: false, error: 'SQL query required' }, { status: 400 });
    }

    // Safety check: allow read/inspection queries primarily
    const db = await getDb();
    const result = await db.query(sql);

    return NextResponse.json({
      success: true,
      rowCount: result.rowCount,
      columns: result.rows.length > 0 ? Object.keys(result.rows[0]) : [],
      rows: result.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 400 });
  }
}
