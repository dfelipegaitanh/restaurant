'use client';

import React, { useState } from 'react';
import { OrderSummary, OrderStatus } from '@/types/domain';
import SemaphoroBadge from './SemaphoroBadge';
import { formatClockTime } from '@/lib/utils/formatters';

interface ComandaCardProps {
  order: OrderSummary;
  onAdvanceStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
}

export default function ComandaCard({ order, onAdvanceStatus }: ComandaCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  let nextStatus: OrderStatus | null = null;
  let actionLabel = '';
  let actionStyle = '';

  if (order.status === 'PENDING') {
    nextStatus = 'IN_PREP';
    actionLabel = 'A Cocinar';
    actionStyle = 'bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold';
  } else if (order.status === 'IN_PREP') {
    nextStatus = 'READY';
    actionLabel = 'Marcar Listo';
    actionStyle = 'bg-emerald-400 hover:bg-emerald-300 text-neutral-950 font-semibold';
  } else if (order.status === 'READY') {
    nextStatus = 'SERVED';
    actionLabel = 'Despachado / Servido';
    actionStyle = 'bg-blue-400 hover:bg-blue-300 text-neutral-950 font-semibold';
  }

  const handleAction = async () => {
    if (!nextStatus || isUpdating) return;
    setIsUpdating(true);
    try {
      await onAdvanceStatus(order.id, nextStatus);
    } finally {
      setIsUpdating(false);
    }
  };

  const tableNumberDisplay = order.table_number || order.table_id.replace('table-', '');

  return (
    <article
      className="bg-[#121216] border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between shadow-xl space-y-4 hover:border-white/[0.15] transition relative overflow-hidden"
      style={{
        viewTransitionName: `comanda-${order.id}`,
      }}
    >
      {/* Ticket Header */}
      <header className="flex items-start justify-between border-b border-white/[0.06] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-mono font-medium text-white tracking-tight">
              #{order.order_number}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Mesa {tableNumberDisplay}
            </span>
          </div>
          <p className="text-[11px] font-mono text-neutral-500 mt-1">
            Hora: {formatClockTime(order.created_at)}
          </p>
        </div>

        <SemaphoroBadge createdAt={order.created_at} />
      </header>

      {/* Items & Modifiers List */}
      <div className="space-y-2.5 flex-1 overflow-y-auto max-h-64 pr-1">
        {order.items.map((item, idx) => (
          <div
            key={idx}
            className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2"
          >
            {/* Dish quantity & name */}
            <div className="flex items-baseline gap-2.5">
              <span className="min-w-[24px] h-6 px-1.5 rounded bg-white/[0.06] text-amber-300 font-mono text-xs font-medium flex items-center justify-center">
                {item.quantity}x
              </span>
              <span className="font-serif text-sm font-normal text-white leading-tight">
                {item.product_name}
              </span>
            </div>

            {/* Relational Modifiers Tag Breakdown */}
            {item.modifiers && item.modifiers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {item.modifiers.map((mod, mIdx) => {
                  let badgeStyle = '';
                  let prefix = '';

                  if (mod.action_type === 'EXTRA') {
                    badgeStyle = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
                    prefix = '+';
                  } else if (mod.action_type === 'NO') {
                    badgeStyle = 'bg-rose-500/10 text-rose-300 border-rose-500/20';
                    prefix = 'Sin';
                  } else {
                    badgeStyle = 'bg-white/[0.04] text-neutral-300 border-white/[0.08]';
                    prefix = '';
                  }

                  return (
                    <span
                      key={mIdx}
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${badgeStyle}`}
                    >
                      {prefix && <span className="opacity-70">{prefix}</span>}
                      <span>{mod.name.replace(/^(Sin|Extra)\s+/i, '')}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Ticket Footer Action Button */}
      {nextStatus && (
        <footer className="pt-2 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={handleAction}
            disabled={isUpdating}
            className={`w-full min-h-[46px] rounded-xl text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95 shadow-md ${actionStyle} ${
              isUpdating ? 'opacity-50 cursor-wait' : ''
            }`}
          >
            {isUpdating ? (
              <span>Actualizando...</span>
            ) : (
              <>
                <span>{actionLabel}</span>
                <span>&rarr;</span>
              </>
            )}
          </button>
        </footer>
      )}

      {order.status === 'SERVED' && (
        <footer className="pt-2 border-t border-white/[0.06] text-center">
          <span className="text-[11px] font-mono text-neutral-500 flex items-center justify-center gap-1">
            <span>✓</span>
            <span>Comanda Despachada</span>
          </span>
        </footer>
      )}
    </article>
  );
}
