'use client';

import React from 'react';
import { Product } from '@/types/domain';
import {
  CartEntry,
  CartTotals,
  ComboItemConfig,
  ItemModifiers,
  isMainDish,
} from '@/lib/kiosk/cart';
import { SwapPickerTarget } from '../_hooks/useKioskCart';
import { CartItemCard } from './CartItemCard';

interface CartDrawerProps {
  isOpen: boolean;
  cart: Map<string, CartEntry>;
  combosByProduct: Map<string, ComboItemConfig[]>;
  itemModifiers: Map<string, ItemModifiers>;
  customizingProductId: string | null;
  openSwapPicker: SwapPickerTarget | null;
  totals: CartTotals;
  activeCombosCount: number;
  customerName: string;
  nameError: boolean;
  submitting: boolean;
  onClose: () => void;
  onClearCart: () => void;
  onCustomerNameChange: (name: string) => void;
  onConfirmOrder: () => void;
  onAdd: (product: Product) => void;
  onRemove: (productId: string) => void;
  onDelete: (productId: string) => void;
  onAddCombo: (productId: string) => void;
  onRemoveCombo: (productId: string, comboIndex: number) => void;
  onReplicateCombo: (productId: string) => void;
  onSetSwapPicker: (target: SwapPickerTarget | null) => void;
  onUpdateComboField: (
    productId: string,
    comboIndex: number,
    field: keyof ComboItemConfig,
    value: string
  ) => void;
  onToggleCustomizing: (productId: string | null) => void;
  onToggleExclusion: (productId: string, exclusion: string) => void;
  onToggleExtra: (productId: string, extraId: string) => void;
}

/** Slide-over drawer displaying active cart items, nested combos, recipe customizers, and checkout controls. */
export function CartDrawer({
  isOpen,
  cart,
  combosByProduct,
  itemModifiers,
  customizingProductId,
  openSwapPicker,
  totals,
  activeCombosCount,
  customerName,
  nameError,
  submitting,
  onClose,
  onClearCart,
  onCustomerNameChange,
  onConfirmOrder,
  onAdd,
  onRemove,
  onDelete,
  onAddCombo,
  onRemoveCombo,
  onReplicateCombo,
  onSetSwapPicker,
  onUpdateComboField,
  onToggleCustomizing,
  onToggleExclusion,
  onToggleExtra,
}: CartDrawerProps) {
  if (!isOpen) return null;

  const { totalItems, subtotalAmount, totalComboDiscount, totalAmount } = totals;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md sm:max-w-xl bg-[#0e0e12] border-l border-white/10 shadow-2xl flex flex-col justify-between">
          {/* Drawer Header */}
          <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-[#131318]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                🛒
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Mi Pedido Actual</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-500 text-black font-extrabold">
                    {totalItems} items
                  </span>
                </h2>
                <p className="text-[11px] text-neutral-400">
                  Personaliza tus combos, bebidas y platos sin rodeos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {cart.size > 0 && (
                <button
                  onClick={onClearCart}
                  className="text-[11px] font-mono text-red-400/80 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20 transition-all"
                >
                  Vaciar
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 hover:text-white flex items-center justify-center font-bold text-sm transition-all"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Drawer Items List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {cart.size === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center space-y-2 text-neutral-500">
                <span className="text-4xl">🍽️</span>
                <p className="text-sm font-medium">No has seleccionado ningún plato aún.</p>
                <p className="text-xs text-neutral-600">
                  Explora el menú y toca "+ Agregar" en lo que te provoque.
                </p>
              </div>
            ) : (
              Array.from(cart.values()).map(({ product, quantity }) => (
                <CartItemCard
                  key={product.id}
                  product={product}
                  quantity={quantity}
                  combos={
                    isMainDish(product.category_id) ? combosByProduct.get(product.id) || [] : []
                  }
                  modifiers={itemModifiers.get(product.id) || { without: [], extras: [] }}
                  isCustomizing={customizingProductId === product.id}
                  openSwapPicker={openSwapPicker}
                  onAdd={onAdd}
                  onRemove={onRemove}
                  onDelete={onDelete}
                  onAddCombo={onAddCombo}
                  onRemoveCombo={onRemoveCombo}
                  onReplicateCombo={onReplicateCombo}
                  onSetSwapPicker={onSetSwapPicker}
                  onUpdateComboField={onUpdateComboField}
                  onToggleCustomizing={onToggleCustomizing}
                  onToggleExclusion={onToggleExclusion}
                  onToggleExtra={onToggleExtra}
                />
              ))
            )}
          </div>

          {/* Drawer Footer with Checkout */}
          {cart.size > 0 && (
            <div className="p-6 border-t border-white/[0.08] bg-[#131318] space-y-4">
              <div className="space-y-1.5 text-xs text-neutral-300">
                <div className="flex justify-between">
                  <span className="text-neutral-400">
                    Subtotal platos y combos ({totalItems} items):
                  </span>
                  <span className="font-mono">${subtotalAmount.toFixed(2)} CAD</span>
                </div>
                {totalComboDiscount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Ahorro Combo Criollo ({activeCombosCount}x):</span>
                    <span className="font-mono">-${totalComboDiscount.toFixed(2)} CAD</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-white pt-2 border-t border-white/[0.06]">
                  <span>Total Final:</span>
                  <span className="font-mono text-amber-400 text-lg">
                    ${totalAmount.toFixed(2)} <span className="text-xs font-sans">CAD</span>
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tu nombre (obligatorio para turno)"
                    value={customerName}
                    onChange={(e) => onCustomerNameChange(e.target.value)}
                    className={`bg-[#18181c] border rounded-xl px-3.5 py-3 text-xs text-white placeholder-neutral-400 focus:outline-none w-full transition-all ${
                      nameError
                        ? 'border-red-500/80 bg-red-500/[0.04] focus:border-red-500'
                        : 'border-white/[0.12] focus:border-amber-500/60'
                    }`}
                  />
                  {nameError && (
                    <span className="text-[10px] text-red-400 font-mono block mt-1">
                      * El nombre es obligatorio para llamarte por pantalla
                    </span>
                  )}
                </div>

                <button
                  onClick={onConfirmOrder}
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold text-sm tracking-wide shadow-xl shadow-amber-500/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <span>Generando Ticket en Cocina...</span>
                  ) : (
                    <>
                      <span>Confirmar Pedido (${totalAmount.toFixed(2)} CAD)</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
