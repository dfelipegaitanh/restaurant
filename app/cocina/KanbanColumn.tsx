'use client';

import React from 'react';
import { OrderSummary, OrderStatus } from '@/types/domain';
import ComandaCard from './ComandaCard';

interface KanbanColumnProps {
  title: string;
  icon: string;
  status: OrderStatus;
  orders: OrderSummary[];
  color: 'amber' | 'blue' | 'emerald' | 'neutral';
  onAdvanceStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
}

export default function KanbanColumn({
  title,
  orders,
  color,
  onAdvanceStatus,
}: KanbanColumnProps) {
  let indicatorColor = '';

  switch (color) {
    case 'amber':
      indicatorColor = 'bg-amber-400';
      break;
    case 'blue':
      indicatorColor = 'bg-blue-400';
      break;
    case 'emerald':
      indicatorColor = 'bg-emerald-400';
      break;
    default:
      indicatorColor = 'bg-neutral-500';
      break;
  }

  return (
    <section className="flex flex-col bg-[#0d0d10] rounded-2xl border border-white/[0.06] overflow-hidden min-w-[300px] flex-1">
      {/* Column Header */}
      <header className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between bg-[#111115]">
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full ${indicatorColor}`} />
          <h2 className="text-xs font-mono uppercase tracking-widest text-neutral-300 font-medium">{title}</h2>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono text-neutral-400 bg-white/[0.04] border border-white/[0.08] min-w-[24px] text-center">
          {orders.length}
        </span>
      </header>

      {/* Column Orders List */}
      <div className="p-3.5 flex-1 overflow-y-auto space-y-3 scrollbar-thin">
        {orders.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center text-neutral-600 space-y-1">
            <p className="text-xs font-mono text-neutral-600">Sin comandas activas</p>
          </div>
        ) : (
          orders.map((order) => (
            <ComandaCard
              key={order.id}
              order={order}
              onAdvanceStatus={onAdvanceStatus}
            />
          ))
        )}
      </div>
    </section>
  );
}
