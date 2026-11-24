'use client';

import React from 'react';
import { Product } from '@/types/domain';
import {
  AVAILABLE_EXTRAS,
  ComboItemConfig,
  EXCLUSIONS_BY_CATEGORY,
  ItemModifiers,
  isMainDish,
} from '@/lib/kiosk/cart';
import { SwapPickerTarget } from '../_hooks/useKioskCart';
import { ComboBundleSection } from './ComboBundleSection';

interface CartItemCardProps {
  product: Product;
  quantity: number;
  combos: ComboItemConfig[];
  modifiers: ItemModifiers;
  isCustomizing: boolean;
  openSwapPicker: SwapPickerTarget | null;
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

/** Displays a cart item row with delayed thumbnail preview, steppers, per-unit combo slots, and recipe modifier chips. */
export function CartItemCard({
  product,
  quantity,
  combos,
  modifiers,
  isCustomizing,
  openSwapPicker,
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
}: CartItemCardProps) {
  const isMain = isMainDish(product.category_id);
  const availableExclusions =
    EXCLUSIONS_BY_CATEGORY[product.category_id] || EXCLUSIONS_BY_CATEGORY['default'];

  return (
    <div className="bg-[#141419] rounded-2xl p-4 border border-white/[0.06] hover:border-white/[0.12] transition-all space-y-3">
      {/* Parent Item Row */}
      <div className="flex items-start gap-3">
        {/* Delayed Progressive Hover Zoom Thumbnail (700ms - 1s Delay) */}
        <div className="relative group/zoom flex-shrink-0 cursor-pointer">
          <div className="w-16 h-12 rounded-xl overflow-hidden bg-[#1c1c24] border border-white/[0.08]">
            {product.image_url?.startsWith('/') ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-200 group-hover/zoom:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
            )}
          </div>

          {/* Progressive Zoom Popover (Delayed by 700ms) */}
          <div className="pointer-events-none absolute left-0 bottom-full mb-3 z-50 opacity-0 scale-90 translate-y-2 group-hover/zoom:opacity-100 group-hover/zoom:scale-100 group-hover/zoom:translate-y-0 transition-all duration-300 ease-out delay-700 w-64 p-2 bg-[#121216] border border-amber-500/40 rounded-2xl shadow-2xl shadow-black/90">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-2 bg-[#181820]">
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            </div>
            <p className="text-xs font-bold text-white px-1 leading-snug">{product.name}</p>
            <p className="text-[10px] text-neutral-400 px-1 mt-0.5 line-clamp-2 leading-tight">
              {product.description}
            </p>
            <span className="text-[9px] font-mono text-amber-400 px-1 mt-1 block">
              ${product.base_price.toFixed(2)} CAD c/u
            </span>
          </div>
        </div>

        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <h4 className="text-xs font-bold text-white truncate leading-tight">{product.name}</h4>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-mono text-neutral-400">
              ${product.base_price.toFixed(2)} CAD
            </span>
            {quantity > 1 && (
              <span className="text-[10px] font-mono text-amber-400/90 font-medium">
                × {quantity} uds
              </span>
            )}
          </div>

          {/* Active Customization Badges */}
          {(modifiers.without.length > 0 || modifiers.extras.length > 0) && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {modifiers.without.map((w) => (
                <span
                  key={w}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20 line-through"
                >
                  {w}
                </span>
              ))}
              {modifiers.extras.map((extraId) => {
                const extra = AVAILABLE_EXTRAS.find((e) => e.id === extraId);
                return (
                  <span
                    key={extraId}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold"
                  >
                    +{extra?.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Stepper & Trash Controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="flex items-center bg-[#1e1e26] rounded-xl p-0.5 border border-white/[0.08]">
            <button
              onClick={() => onRemove(product.id)}
              className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-white flex items-center justify-center text-xs font-bold transition-all"
            >
              -
            </button>
            <span className="w-6 text-center font-mono font-bold text-amber-400 text-xs">
              {quantity}
            </span>
            <button
              onClick={() => onAdd(product)}
              className="w-7 h-7 rounded-lg bg-amber-500 text-black flex items-center justify-center text-xs font-bold hover:bg-amber-400 transition-all"
            >
              +
            </button>
          </div>
          <button
            onClick={() => onDelete(product.id)}
            className="w-7 h-7 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center text-xs transition-all border border-red-500/20"
            title="Eliminar este plato y sus combos"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Combo Criollo Bundle Section */}
      {isMain && (
        <ComboBundleSection
          productId={product.id}
          quantity={quantity}
          combos={combos}
          openSwapPicker={openSwapPicker}
          onAddCombo={onAddCombo}
          onRemoveCombo={onRemoveCombo}
          onReplicateCombo={onReplicateCombo}
          onSetSwapPicker={onSetSwapPicker}
          onUpdateComboField={onUpdateComboField}
        />
      )}

      {/* Customization Toggle & Tactile Chips */}
      <div className="border-t border-white/[0.04] pt-2">
        <button
          type="button"
          onClick={() => onToggleCustomizing(isCustomizing ? null : product.id)}
          className="text-[11px] font-mono font-medium text-neutral-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
        >
          <span>
            {isCustomizing
              ? '▲ Cerrar personalización de receta'
              : '⚙️ Personalizar ingredientes (Quitar / Agregar)'}
          </span>
        </button>

        {isCustomizing && (
          <div className="mt-2.5 p-3 rounded-xl bg-[#0a0a0d] border border-amber-500/20 space-y-2.5 animate-in fade-in duration-150">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1.5">
                🚫 Quitar Ingredientes (Sin costo):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {availableExclusions.map((ex) => {
                  const isExcluded = modifiers.without.includes(ex);
                  return (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => onToggleExclusion(product.id, ex)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all border ${
                        isExcluded
                          ? 'bg-red-500/20 text-red-300 border-red-500/50 line-through font-bold'
                          : 'bg-[#181820] text-neutral-300 border-white/[0.08] hover:border-white/[0.2]'
                      }`}
                    >
                      {isExcluded ? `✕ ${ex}` : ex}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1.5">
                ✨ Extras Opcionales:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_EXTRAS.map((extra) => {
                  const isAdded = modifiers.extras.includes(extra.id);
                  return (
                    <button
                      key={extra.id}
                      type="button"
                      onClick={() => onToggleExtra(product.id, extra.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all border flex items-center gap-1 ${
                        isAdded
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                          : 'bg-[#181820] text-neutral-300 border-white/[0.08] hover:border-white/[0.2]'
                      }`}
                    >
                      <span>{extra.icon}</span>
                      <span>{extra.name}</span>
                      <span className="text-[10px] opacity-80">(+${extra.price.toFixed(2)})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
