'use client';

import React, { useState } from 'react';
import { CartLineItem } from './ModifierModal';
import { OrderSummary } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/formatters';

interface CartDrawerProps {
  tableId: string;
  items: CartLineItem[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateQuantity: (lineId: string, newQty: number) => void;
  onRemoveItem: (lineId: string) => void;
  onOrderSuccess: (order: OrderSummary) => void;
}

export default function CartDrawer({
  tableId,
  items,
  isOpen,
  onClose,
  onUpdateQuantity,
  onRemoveItem,
  onOrderSuccess,
}: CartDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeIdempotencyKey, setActiveIdempotencyKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  const handleSubmitOrder = async () => {
    if (items.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const idempotencyKey = activeIdempotencyKey || crypto.randomUUID();
    setActiveIdempotencyKey(idempotencyKey);

    const payload = {
      table_id: tableId,
      idempotency_key: idempotencyKey,
      items: items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        modifiers: item.modifiers.map((m) => ({
          modifier_id: m.modifier_id,
        })),
      })),
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 201 || res.status === 200) {
        setActiveIdempotencyKey(null);
        setIsSubmitting(false);
        onOrderSuccess(data.order);
        onClose();
      } else {
        setIsSubmitting(false);
        setErrorMessage(data.error || 'Ocurrió un error al procesar la comanda.');
      }
    } catch (err: any) {
      console.error('[CartDrawer] Network error submitting order:', err);
      setIsSubmitting(false);
      setErrorMessage(
        'Fallo de conexión. Puedes reintentar sin riesgo de duplicar tu orden.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-md flex justify-end">
      <div
        className="w-full max-w-md bg-[#111115] border-l border-white/[0.08] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
      >
        {/* Header */}
        <header className="p-6 border-b border-white/[0.06] flex items-center justify-between bg-[#111115]/95 sticky top-0 z-10">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">Resumen</span>
            <h2 id="cart-title" className="text-xl font-serif font-normal text-white">
              Tu Comanda
            </h2>
            <p className="text-xs font-mono text-neutral-400">
              {items.length === 1 ? '1 plato seleccionado' : `${items.length} platos seleccionados`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar carrito"
            className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-400 hover:text-white hover:bg-white/[0.06] transition"
          >
            ✕
          </button>
        </header>

        {/* Scrollable Item List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-neutral-500 py-20 space-y-3">
              <span className="text-2xl font-serif italic text-neutral-600">Vacío</span>
              <p className="text-xs text-neutral-400 max-w-xs font-light">
                Agrega platos desde la carta para conformar tu comanda.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.line_id}
                className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-base font-normal text-white">
                      {item.product_name}
                    </h3>
                    <p className="text-xs font-mono text-amber-300/80">
                      {formatCurrency(item.unit_price)} c/u
                    </p>
                  </div>
                  <button
                    onClick={() => onRemoveItem(item.line_id)}
                    className="text-neutral-500 hover:text-red-400 text-xs font-mono p-1 transition"
                    aria-label={`Eliminar ${item.product_name}`}
                  >
                    Quitar
                  </button>
                </div>

                {/* Modifiers list */}
                {item.modifiers.length > 0 && (
                  <div className="bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.04] space-y-1">
                    <ul className="space-y-1">
                      {item.modifiers.map((mod) => (
                        <li
                          key={mod.modifier_id}
                          className="text-[11px] text-neutral-300 flex items-center justify-between font-mono"
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`w-1 h-1 rounded-full ${
                                mod.action_type === 'EXTRA'
                                  ? 'bg-emerald-400'
                                  : mod.action_type === 'NO'
                                  ? 'bg-rose-400'
                                  : 'bg-amber-400'
                              }`}
                            />
                            <span>{mod.name}</span>
                          </span>
                          {mod.price_delta > 0 && (
                            <span className="text-neutral-400 text-[10px]">
                              +{formatCurrency(mod.price_delta)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Stepper & Line Total */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                  <div className="flex items-center gap-2 bg-white/[0.03] p-1 rounded-lg border border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.line_id, item.quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-white/[0.04] text-neutral-300 font-mono text-xs hover:bg-white/[0.08] transition active:scale-95"
                      aria-label="Disminuir cantidad"
                    >
                      -
                    </button>
                    <span className="w-5 text-center font-mono text-xs text-white">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.line_id, item.quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-white/[0.04] text-neutral-300 font-mono text-xs hover:bg-white/[0.08] transition active:scale-95"
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>

                  <span className="font-serif text-base font-medium text-amber-300">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with Summary & Checkout CTA */}
        {items.length > 0 && (
          <footer className="p-6 border-t border-white/[0.06] bg-[#0d0d10] sticky bottom-0 z-10 space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-mono rounded-xl">
                {errorMessage}
              </div>
            )}

            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-serif font-medium text-white pt-2 border-t border-white/[0.06]">
                <span>Total Comanda</span>
                <span className="text-amber-300">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmitOrder}
              disabled={isSubmitting}
              className={`w-full min-h-[50px] rounded-xl text-xs font-medium tracking-wide flex items-center justify-center gap-2 transition ${
                isSubmitting
                  ? 'bg-amber-600/50 text-neutral-900 cursor-wait'
                  : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold shadow-xl shadow-amber-500/20 active:scale-95'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                  <span>Enviando Comanda a Cocina...</span>
                </>
              ) : (
                <>
                  <span>Enviar Pedido a Cocina</span>
                  <span>&rarr;</span>
                </>
              )}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
