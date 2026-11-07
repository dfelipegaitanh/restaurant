'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface TableData {
  tables: string[];
  activeTable: string;
  rowCount: number;
  columns: string[];
  rows: Record<string, any>[];
}

export default function DbExplorerPage() {
  const [data, setData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTable, setCurrentTable] = useState('products');
  const [customSql, setCustomSql] = useState('');
  const [sqlResult, setSqlResult] = useState<{ columns: string[]; rows: any[]; error?: string } | null>(null);
  const [executing, setExecuting] = useState(false);

  const fetchTable = async (table: string) => {
    setLoading(true);
    setSqlResult(null);
    try {
      const res = await fetch(`/api/db/query?table=${encodeURIComponent(table)}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
        setCurrentTable(json.activeTable);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTable(currentTable);
  }, []);

  const runSql = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customSql.trim()) return;
    setExecuting(true);
    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: customSql }),
      });
      const json = await res.json();
      if (json.success) {
        setSqlResult({ columns: json.columns, rows: json.rows });
      } else {
        setSqlResult({ columns: [], rows: [], error: json.error });
      }
    } catch (err: any) {
      setSqlResult({ columns: [], rows: [], error: err.message });
    } finally {
      setExecuting(false);
    }
  };

  const displayColumns = sqlResult ? sqlResult.columns : data?.columns || [];
  const displayRows = sqlResult ? sqlResult.rows : data?.rows || [];

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-200 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-300">
      {/* Top Header */}
      <header className="border-b border-white/[0.08] bg-[#0c0c0e]/90 backdrop-blur-xl px-6 py-4 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-serif font-bold text-sm hover:bg-amber-500/20 transition-colors"
          >
            ←
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-white tracking-tight">PostgreSQL 16 Explorer</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PGlite WASM • Activa
              </span>
            </div>
            <p className="text-xs text-neutral-400">Inspección de tablas relacionales en vivo y consola SQL</p>
          </div>
        </div>

        <div className="text-xs font-mono text-neutral-400">
          Ubicación en disco: <code className="text-amber-300 bg-white/[0.04] px-1.5 py-0.5 rounded">./data/pglite_db</code>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 gap-4">
        {/* Sidebar: Tables List */}
        <aside className="w-full md:w-56 flex-shrink-0 space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 px-2 font-medium">
            Tablas del Sistema ({data?.tables.length || 0})
          </span>
          <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {data?.tables.map((t) => (
              <button
                key={t}
                onClick={() => fetchTable(t)}
                className={`text-left px-3 py-2 rounded-xl text-xs font-mono transition-all flex items-center justify-between whitespace-nowrap ${
                  currentTable === t && !sqlResult
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold'
                    : 'bg-white/[0.03] text-neutral-400 hover:text-white hover:bg-white/[0.06] border border-transparent'
                }`}
              >
                <span>{t}</span>
                {currentTable === t && !sqlResult && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                )}
              </button>
            ))}
          </div>

          {/* Quick SQL Helper */}
          <div className="pt-4 border-t border-white/[0.06] hidden md:block">
            <span className="text-[11px] font-mono text-neutral-400 block mb-2 font-medium">Atajos Rápidos:</span>
            <div className="space-y-1">
              <button
                onClick={() => {
                  setCustomSql("SELECT id, name, base_price, category_id FROM products ORDER BY base_price DESC;");
                }}
                className="text-[11px] text-left text-neutral-400 hover:text-amber-300 block w-full truncate py-1 font-mono"
              >
                • Productos por precio
              </button>
              <button
                onClick={() => {
                  setCustomSql("SELECT id, order_number, table_id, status, total_amount, created_at FROM orders ORDER BY created_at DESC;");
                }}
                className="text-[11px] text-left text-neutral-400 hover:text-amber-300 block w-full truncate py-1 font-mono"
              >
                • Últimas órdenes
              </button>
              <button
                onClick={() => {
                  setCustomSql("SELECT p.name, c.name as categoria, p.base_price FROM products p JOIN categories c ON p.category_id = c.id;");
                }}
                className="text-[11px] text-left text-neutral-400 hover:text-amber-300 block w-full truncate py-1 font-mono"
              >
                • Productos + Categorías
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col space-y-4 min-w-0">
          {/* SQL Query Box */}
          <form onSubmit={runSql} className="bg-[#121215] border border-white/[0.08] rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-amber-400/90 font-medium flex items-center gap-1.5">
                <span>⚡ Consola SQL Directa</span>
              </span>
              <div className="flex items-center gap-2">
                {customSql && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomSql('');
                      setSqlResult(null);
                    }}
                    className="text-[11px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-white/[0.04]"
                  >
                    Limpiar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={executing || !customSql.trim()}
                  className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-all disabled:opacity-40"
                >
                  {executing ? 'Ejecutando...' : 'Ejecutar SQL'}
                </button>
              </div>
            </div>
            <textarea
              rows={2}
              value={customSql}
              onChange={(e) => setCustomSql(e.target.value)}
              placeholder="Ej: SELECT * FROM products WHERE category_id = 'burgers';"
              className="w-full bg-[#0a0a0c] border border-white/[0.06] rounded-xl p-2.5 text-xs font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-amber-500/40"
            />
          </form>

          {/* Table Header Details */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white">
                {sqlResult ? 'Resultado de Query SQL' : `Tabla: ${currentTable}`}
              </span>
              <span className="text-[11px] font-mono text-neutral-400 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.06]">
                {displayRows.length} {displayRows.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
            {sqlResult && (
              <button
                onClick={() => fetchTable(currentTable)}
                className="text-xs text-amber-400 hover:underline font-mono"
              >
                ← Volver a vista de tabla
              </button>
            )}
          </div>

          {/* SQL Error Alert */}
          {sqlResult?.error && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-mono">
              ❌ Error SQL: {sqlResult.error}
            </div>
          )}

          {/* Data Grid Table */}
          <div className="flex-1 bg-[#121215] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col shadow-xl">
            {loading ? (
              <div className="flex-1 flex items-center justify-center p-12 text-neutral-400 text-xs font-mono">
                Cargando registros...
              </div>
            ) : displayRows.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-12 text-neutral-400 text-xs font-mono">
                Tabla vacía (0 registros).
              </div>
            ) : (
              <div className="overflow-x-auto flex-1 max-h-[560px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#18181c] sticky top-0 z-10 border-b border-white/[0.08]">
                    <tr>
                      {displayColumns.map((col) => (
                        <th key={col} className="p-3 font-mono text-neutral-400 font-medium whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {displayRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        {displayColumns.map((col) => {
                          const val = row[col];
                          const formatted =
                            val === null || val === undefined
                              ? 'NULL'
                              : typeof val === 'object'
                              ? JSON.stringify(val)
                              : String(val);

                          const isNull = val === null || val === undefined;
                          const isPrice = col.includes('price') || col.includes('amount');

                          return (
                            <td
                              key={col}
                              className={`p-3 font-mono whitespace-nowrap max-w-xs truncate ${
                                isNull
                                  ? 'text-neutral-600 italic'
                                  : isPrice
                                  ? 'text-emerald-400 font-semibold'
                                  : 'text-neutral-300'
                              }`}
                              title={formatted}
                            >
                              {isPrice && !isNull ? `$${Number(val).toFixed(2)} CAD` : formatted}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
