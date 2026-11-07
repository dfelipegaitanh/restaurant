'use client';

import React from 'react';
import { TableSummary } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/formatters';

interface TableCardProps {
  table: TableSummary;
  onSelectTable: (table: TableSummary) => void;
}

export default function TableCard({ table, onSelectTable }: TableCardProps) {
  const isOccupied = table.status === 'OCCUPIED' || (table.active_orders_count ?? 0) > 0;
  const isBillRequested = table.status === 'BILL_REQUESTED';
  const isClosed = table.status === 'CLOSED';

  let statusBadgeStyle = '';
  let statusText = 'Disponible';
  let cardBorder = 'border-white/[0.06] hover:border-white/[0.12]';

  if (isBillRequested) {
    statusBadgeStyle = 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse';
    statusText = 'Cuenta Solicitada';
    cardBorder = 'border-amber-500/30 bg-amber-500/[0.02]';
  } else if (isOccupied) {
    statusBadgeStyle = 'bg-blue-500/10 text-blue-300 border-blue-500/20';
    statusText = 'Ocupada';
    cardBorder = 'border-white/[0.1] bg-white/[0.02]';
  } else if (isClosed) {
    statusBadgeStyle = 'bg-white/[0.02] text-neutral-500 border-white/[0.06]';
    statusText = 'Cerrada';
  } else {
    statusBadgeStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    statusText = 'Disponible';
  }

  return (
    <article
      className={`rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 shadow-lg ${cardBorder} bg-[#121216]`}
    >
      {/* Table Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Mesa</span>
              <h2 className="text-2xl font-serif font-medium text-white">
                {table.table_number}
              </h2>
            </div>
            <p className="text-[11px] font-mono text-neutral-500 mt-0.5">
              Capacidad: {table.capacity} comensales
            </p>
          </div>

          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${statusBadgeStyle}`}
          >
            {statusText}
          </span>
        </div>

        {/* Order count & total amount */}
        <div className="bg-white/[0.02] p-3.5 rounded-xl border border-white/[0.04] space-y-1.5 font-mono text-xs">
          <div className="flex justify-between text-neutral-400">
            <span>Comandas activas</span>
            <span className="text-white">
              {table.active_orders_count ?? 0}
            </span>
          </div>

          <div className="flex justify-between items-baseline pt-2 border-t border-white/[0.04]">
            <span className="text-neutral-400">Acumulado</span>
            <span className="text-base font-serif font-medium text-amber-300">
              {formatCurrency(table.total_unpaid_amount ?? 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Action CTA */}
      <div className="pt-4 mt-2">
        <button
          type="button"
          onClick={() => onSelectTable(table)}
          className={`w-full min-h-[44px] rounded-xl text-xs font-mono tracking-wide flex items-center justify-center gap-2 transition active:scale-95 ${
            isOccupied || isBillRequested
              ? 'bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold shadow-sm'
              : 'bg-white/[0.03] hover:bg-white/[0.06] text-neutral-300 border border-white/[0.08]'
          }`}
        >
          <span>{isOccupied || isBillRequested ? 'Gestionar Cuenta' : 'Detalles'}</span>
          <span>&rarr;</span>
        </button>
      </div>
    </article>
  );
}
