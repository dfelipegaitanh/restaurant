'use client';

import React from 'react';
import { OrderSummary } from '@/types/domain';

interface OrderConfirmedModalProps {
  order: OrderSummary | null;
  countdown: number;
  onReset: () => void;
}

/** Full-screen post-checkout modal presenting the sequential ticket number and countdown reset. */
export function OrderConfirmedModal({ order, countdown, onReset }: OrderConfirmedModalProps) {
  if (!order) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b]/98 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
      <div className="max-w-md w-full bg-[#121216] border border-amber-500/30 rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            ✓ Pedido Enviado a Cocina
          </span>
          <h2 className="text-xl font-bold text-white">¡Gracias por tu pedido!</h2>
          {order.customer_name && (
            <p className="text-sm text-amber-300 font-medium">Comensal: {order.customer_name}</p>
          )}
        </div>

        {/* Huge Ticket Number */}
        <div className="bg-[#181820] rounded-2xl py-8 px-4 border border-white/[0.08] space-y-1">
          <span className="text-xs font-mono uppercase tracking-widest text-neutral-400 font-semibold">
            Número de Turno
          </span>
          <div className="text-6xl md:text-7xl font-mono font-black text-amber-400 tracking-tight">
            #{order.order_number}
          </div>
          <span className="text-xs text-neutral-400 block pt-1">
            Total: ${order.total_amount.toFixed(2)} CAD
          </span>
        </div>

        {/* Order Items Preview */}
        <div className="text-left text-xs text-neutral-300 space-y-1 max-h-36 overflow-y-auto pr-1">
          <span className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">
            Resumen del Ticket:
          </span>
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between py-1 border-b border-white/[0.04]">
              <span>
                {item.quantity}x {item.product_name}
              </span>
              <span className="font-mono text-neutral-400">${item.subtotal.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">
          Toma asiento. Te llamaremos por tu número de turno en cuanto esté listo tu pedido en cocina.
        </p>

        {/* Auto-reset Countdown */}
        <div className="pt-2">
          <button
            onClick={onReset}
            className="w-full py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-mono text-white transition-all flex items-center justify-center gap-2"
          >
            <span>Siguiente Cliente</span>
            <span className="text-amber-400">({countdown}s)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
