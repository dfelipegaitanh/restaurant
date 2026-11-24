'use client';

import React from 'react';
import { CartTotals, MainComboStats } from '@/lib/kiosk/cart';

interface FloatingOrderBarProps {
  hasItems: boolean;
  totals: CartTotals;
  comboStats: MainComboStats;
  customerName: string;
  nameError: boolean;
  submitting: boolean;
  onOpenDrawer: () => void;
  onCustomerNameChange: (name: string) => void;
  onConfirmOrder: () => void;
}

/** Fixed bottom bar summarizing active combo progress, total price, and one-tap checkout controls. */
export function FloatingOrderBar({
  hasItems,
  totals,
  comboStats,
  customerName,
  nameError,
  submitting,
  onOpenDrawer,
  onCustomerNameChange,
  onConfirmOrder,
}: FloatingOrderBarProps) {
  if (!hasItems) return null;

  const { totalItems, subtotalAmount, totalComboDiscount, totalAmount } = totals;
  const { totalMains, activeCombosCount, mainsWithoutComboCount } = comboStats;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c0c0e]/95 backdrop-blur-2xl border-t border-amber-500/20 p-4 shadow-2xl">
      <div className="max-w-4xl mx-auto space-y-3">
        {/* Dynamic Multi-Combo Progress Banner */}
        {totalMains > 0 && (
          <div
            className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border transition-all ${
              mainsWithoutComboCount === 0
                ? 'bg-emerald-950/40 border-emerald-500/30'
                : 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-2xl flex-shrink-0">{activeCombosCount > 0 ? '🎉' : '🍟🥤'}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white tracking-wide">
                    {mainsWithoutComboCount === 0
                      ? `¡Todos tus platos (${totalMains}) son Combo Criollo!`
                      : activeCombosCount > 0
                      ? `¡${activeCombosCount} de ${totalMains} platos en combo!`
                      : '¿Quieres volver tus platos Combo Criollo?'}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                      activeCombosCount > 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {activeCombosCount > 0
                      ? `-$${totalComboDiscount.toFixed(2)} CAD Ahorro Total`
                      : 'Solo +$7.50 CAD por plato'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  {mainsWithoutComboCount > 0
                    ? 'Abre el pedido para elegir bebida y acompañamiento para cada hamburguesa, perro o salchipapa.'
                    : 'Cada plato principal incluye su acompañamiento y bebida con descuento.'}
                </p>
              </div>
            </div>

            <button
              onClick={onOpenDrawer}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold text-xs tracking-wide shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <span>Ver / Personalizar Combos</span>
              <span>↗</span>
            </button>
          </div>
        )}

        {/* Bottom Bar Content with Clickable Drawer Trigger */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={onOpenDrawer}
            className="group flex items-center gap-4 w-full sm:w-auto hover:opacity-90 transition-all text-left"
            title="Toca para ver o modificar tu pedido actual"
          >
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-black flex items-center justify-center font-mono font-black text-lg shadow-lg shadow-amber-500/30 group-hover:scale-105 group-hover:bg-amber-400 transition-all">
                {totalItems}
              </div>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0c0c0e] rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0c0c0e] rounded-full" />
            </div>
            <div>
              <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                <span>Total a pagar:</span>
                {totalComboDiscount > 0 && (
                  <span className="line-through text-neutral-500 font-mono text-[11px]">
                    ${subtotalAmount.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1.5">
                <span>${totalAmount.toFixed(2)}</span>
                <span className="text-xs text-amber-400 font-sans font-semibold">CAD</span>
              </div>
              <span className="text-[11px] text-amber-300 font-mono flex items-center gap-1 group-hover:underline">
                <span>Ver / Editar pedido</span>
                <span>↗</span>
              </span>
            </div>
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-56">
              <input
                type="text"
                placeholder="Tu nombre (obligatorio)"
                value={customerName}
                onChange={(e) => onCustomerNameChange(e.target.value)}
                className={`bg-[#18181c] border rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-neutral-400 focus:outline-none w-full transition-all ${
                  nameError
                    ? 'border-red-500/80 bg-red-500/[0.04] focus:border-red-500 shadow-sm shadow-red-500/20'
                    : 'border-white/[0.12] focus:border-amber-500/60'
                }`}
              />
              {nameError && (
                <span className="absolute -bottom-4 left-1 text-[10px] text-red-400 font-mono">
                  * Nombre obligatorio
                </span>
              )}
            </div>
            <button
              onClick={onConfirmOrder}
              disabled={submitting}
              className="w-full sm:w-auto px-7 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold text-sm tracking-wide shadow-xl shadow-amber-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {submitting ? (
                <span>Generando Ticket...</span>
              ) : (
                <>
                  <span>Confirmar Pedido</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
