'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { TableSummary } from '@/types/domain';
import TableCard from './TableCard';
import BillModal from './BillModal';
import { formatCurrency } from '@/lib/utils/formatters';

export default function CajaPage() {
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<TableSummary | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const loadTables = useCallback(async () => {
    try {
      const res = await fetch('/api/tables');
      const data = await res.json();
      if (data.success && Array.isArray(data.tables)) {
        setTables(data.tables);
      }
    } catch (err) {
      console.error('[Caja] Error loading tables:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    let es: EventSource | null = null;

    try {
      es = new EventSource('/api/realtime');

      es.onopen = () => {
        setIsConnected(true);
      };

      es.onerror = () => {
        setIsConnected(false);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (
            data.type === 'ORDER_CREATED' ||
            data.type === 'ORDER_STATUS_CHANGED' ||
            data.type === 'TABLE_STATUS_CHANGED' ||
            data.type === 'PAYMENT_COMPLETED'
          ) {
            loadTables();
          }
        } catch {
          // SSE heartbeat
        }
      };
    } catch (err) {
      console.warn('[Caja] SSE connection error:', err);
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [loadTables]);

  const handleSelectTable = (table: TableSummary) => {
    setSelectedTable(table);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTable(null);
  };

  const handlePaymentSuccess = () => {
    loadTables();
  };

  const handleTableClosed = () => {
    loadTables();
    handleCloseModal();
  };

  const occupiedCount = tables.filter(
    (t) => t.status === 'OCCUPIED' || (t.active_orders_count ?? 0) > 0
  ).length;
  const availableCount = tables.filter((t) => t.status === 'AVAILABLE' && (t.active_orders_count ?? 0) === 0).length;
  const totalUnpaid = tables.reduce((sum, t) => sum + (t.total_unpaid_amount ?? 0), 0);

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-200 flex flex-col font-sans">
      {/* 1. Top Bar */}
      <header className="bg-[#0c0c0e]/90 backdrop-blur-xl border-b border-white/[0.06] px-6 md:px-10 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-neutral-400 hover:text-white transition text-xs font-mono flex items-center gap-1.5"
            title="Volver al hub"
          >
            <span>&larr;</span>
            <span className="hidden sm:inline">Hub</span>
          </Link>

          <div className="h-4 w-[1px] bg-white/[0.08] hidden sm:block" />

          <div className="flex items-center gap-3">
            <span className="font-serif text-base tracking-tight text-white font-medium">Bistro Caja</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-white/[0.04] text-neutral-300 border border-white/[0.08]">
              {tables.length} Mesas
            </span>
          </div>
        </div>

        {/* Real-time Connection Indicator */}
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 rounded-full text-[11px] font-mono border flex items-center gap-1.5 ${
              isConnected
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                : 'bg-red-950/40 text-red-300 border-red-800/60 animate-pulse'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            <span className="hidden md:inline">
              {isConnected ? 'SSE Sincronizado' : 'Reconectando'}
            </span>
          </div>

          <button
            type="button"
            onClick={loadTables}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-neutral-300 text-xs font-mono transition"
            title="Refrescar estado de mesas"
            aria-label="Refrescar estado de mesas"
          >
            ↻
          </button>
        </div>
      </header>

      {/* 2. Metrics Bar */}
      <section className="bg-white/[0.01] border-b border-white/[0.06] px-6 md:px-10 py-5">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#121216] border border-white/[0.06] rounded-2xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Mesas Disponibles
            </p>
            <p className="text-2xl font-serif font-medium text-emerald-400 mt-1">
              {availableCount} <span className="text-xs font-mono text-neutral-500">/ {tables.length}</span>
            </p>
          </div>

          <div className="bg-[#121216] border border-white/[0.06] rounded-2xl p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Mesas Ocupadas
            </p>
            <p className="text-2xl font-serif font-medium text-amber-300 mt-1">
              {occupiedCount}
            </p>
          </div>

          <div className="bg-[#121216] border border-white/[0.06] rounded-2xl p-4 col-span-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Consumo Activo en Salón
            </p>
            <p className="text-2xl font-serif font-medium text-white mt-1">
              {formatCurrency(totalUnpaid)}
            </p>
          </div>
        </div>
      </section>

      {/* 3. Floorplan Tables Grid */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {isLoading ? (
          <div className="py-32 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-6 h-6 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
            <p className="text-xs text-neutral-500 font-mono tracking-wider">Cargando estado del salón...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {tables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                onSelectTable={handleSelectTable}
              />
            ))}
          </div>
        )}
      </main>

      {/* 4. Bill & Payment Modal */}
      <BillModal
        table={selectedTable}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onPaymentSuccess={handlePaymentSuccess}
        onTableClosed={handleTableClosed}
      />
    </div>
  );
}
