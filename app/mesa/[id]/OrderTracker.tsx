'use client';

import React, { useEffect, useState } from 'react';
import { OrderStatus, OrderSummary } from '@/types/domain';
import { formatCurrency, formatClockTime } from '@/lib/utils/formatters';

interface OrderTrackerProps {
  tableId: string;
  latestOrder: OrderSummary | null;
  onClose: () => void;
}

const STATUS_STEPS: { key: OrderStatus; label: string; desc: string }[] = [
  { key: 'PENDING', label: 'Recibida en Cocina', desc: 'Tu comanda ingresó a la estación de comandas' },
  { key: 'IN_PREP', label: 'En Preparación', desc: 'Los cocineros están en marcha con tus platos' },
  { key: 'READY', label: 'Lista para Servir', desc: 'Platos terminados en pase de cocina' },
  { key: 'SERVED', label: 'Servida en Mesa', desc: '¡Buen provecho! Comanda entregada' },
];

export default function OrderTracker({
  latestOrder: initialOrder,
  onClose,
}: OrderTrackerProps) {
  const [currentOrder, setCurrentOrder] = useState<OrderSummary | null>(initialOrder);

  useEffect(() => {
    setCurrentOrder(initialOrder);
  }, [initialOrder]);

  useEffect(() => {
    if (!currentOrder) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ORDER_STATUS_CHANGED') {
            const { order_id, new_status, updated_at } = data.payload;
            if (currentOrder && order_id === currentOrder.id) {
              setCurrentOrder((prev) => (prev ? { ...prev, status: new_status, updated_at } : null));
            }
          }
        } catch {
          // SSE ping
        }
      };
    } catch (err) {
      console.warn('[OrderTracker] SSE connection error:', err);
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [currentOrder?.id]);

  if (!currentOrder) return null;

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === currentOrder.status);
  const isCancelled = currentOrder.status === 'CANCELLED';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#121216] border border-white/[0.08] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/[0.06] pb-4">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">Seguimiento</span>
            <h3 className="text-xl font-serif font-normal text-white">
              Comanda #{currentOrder.order_number}
            </h3>
            <p className="text-xs font-mono text-neutral-500">
              Registrada: {formatClockTime(currentOrder.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-400 hover:text-white hover:bg-white/[0.06] transition"
            aria-label="Cerrar seguimiento"
          >
            ✕
          </button>
        </div>

        {/* Stepper */}
        {isCancelled ? (
          <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-xl text-center">
            <p className="text-red-300 font-mono text-sm">Comanda Cancelada</p>
          </div>
        ) : (
          <div className="py-2">
            <div className="relative border-l border-white/[0.1] ml-3.5 pl-6 space-y-6">
              {STATUS_STEPS.map((step, idx) => {
                const isPassed = currentStepIndex >= idx;
                const isCurrent = currentStepIndex === idx;

                return (
                  <div key={step.key} className="relative">
                    {/* Step Indicator Dot */}
                    <div
                      className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border transition-all duration-300 ${
                        isCurrent
                          ? 'bg-amber-400 border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)] animate-pulse'
                          : isPassed
                          ? 'bg-emerald-400 border-emerald-400'
                          : 'bg-[#18181f] border-neutral-700'
                      }`}
                    />

                    <div>
                      <h4
                        className={`text-xs font-mono tracking-wide ${
                          isCurrent
                            ? 'text-amber-300 font-semibold'
                            : isPassed
                            ? 'text-white'
                            : 'text-neutral-500'
                        }`}
                      >
                        {step.label}
                      </h4>
                      <p className="text-xs text-neutral-400 mt-0.5 font-light">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Items Summary */}
        <div className="bg-white/[0.02] rounded-xl p-4 border border-white/[0.04] space-y-2 max-h-44 overflow-y-auto">
          <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
            Platos en esta comanda
          </p>
          {currentOrder.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-start text-xs py-1 border-b border-white/[0.04] last:border-none">
              <div>
                <span className="text-neutral-200 font-serif">
                  {item.quantity}x {item.product_name}
                </span>
                {item.modifiers && item.modifiers.length > 0 && (
                  <p className="text-[11px] text-neutral-400 font-mono">
                    {item.modifiers.map((m) => m.name).join(', ')}
                  </p>
                )}
              </div>
              <span className="font-mono text-amber-300/80">
                {formatCurrency(item.subtotal)}
              </span>
            </div>
          ))}
          <div className="pt-2 flex justify-between text-xs font-mono text-white border-t border-white/[0.06]">
            <span className="text-neutral-400">Total</span>
            <span className="text-amber-300 font-serif text-sm font-medium">{formatCurrency(currentOrder.total_amount)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="w-full min-h-[44px] px-6 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-mono text-neutral-200 transition active:scale-95"
          >
            Volver a la Carta
          </button>
        </div>
      </div>
    </div>
  );
}
