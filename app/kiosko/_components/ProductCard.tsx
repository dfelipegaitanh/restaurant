'use client';

import React from 'react';
import { Product } from '@/types/domain';

interface ProductCardProps {
  product: Product;
  quantity: number;
  combosCount: number;
  isDescriptionExpanded: boolean;
  onToggleDescription: (productId: string) => void;
  onAdd: (product: Product) => void;
  onRemove: (productId: string) => void;
  onCustomize: (productId: string) => void;
}

/** Renders an interactive kiosk menu product card with expandable recipe and quick cart steppers. */
export function ProductCard({
  product,
  quantity,
  combosCount,
  isDescriptionExpanded,
  onToggleDescription,
  onAdd,
  onRemove,
  onCustomize,
}: ProductCardProps) {
  const hasCombosAttached = combosCount > 0;

  return (
    <div
      className={`group relative bg-[#121216] rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
        quantity > 0
          ? 'border-amber-500/50 bg-gradient-to-b from-amber-500/[0.06] to-[#121216] shadow-xl shadow-amber-500/5'
          : 'border-white/[0.06] hover:border-white/[0.15]'
      }`}
    >
      <div>
        {/* Product Visual Header */}
        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#181820] mb-3.5 border border-white/[0.06]">
          {product.image_url && product.image_url.startsWith('/') ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-white/[0.04] to-transparent text-5xl">
              <span>{product.image_url || '🍽️'}</span>
            </div>
          )}

          {/* Floating Price Badge */}
          <div className="absolute top-3 right-3 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/[0.12] shadow-lg">
            <span className="text-sm font-bold text-amber-300 font-mono">
              ${product.base_price.toFixed(2)}
            </span>
            <span className="text-[9px] text-neutral-400 font-mono ml-1">CAD</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-bold text-white group-hover:text-amber-200 transition-colors leading-snug">
              {product.name}
            </h3>
            {hasCombosAttached && (
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold whitespace-nowrap">
                {combosCount}x Combo
              </span>
            )}
          </div>

          {/* Expandable Recipe Description (Hover & Tap Toggle) */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggleDescription(product.id);
            }}
            className="cursor-pointer group/desc relative"
            title="Toca para fijar u ocultar la receta completa"
          >
            <p
              className={`text-xs text-neutral-400 leading-relaxed font-light transition-all duration-200 group-hover/desc:text-neutral-200 ${
                isDescriptionExpanded
                  ? 'line-clamp-none text-neutral-200'
                  : 'line-clamp-2 group-hover/desc:line-clamp-none'
              }`}
            >
              {product.description}
            </p>
            {product.description && product.description.length > 70 && (
              <div className="flex items-center gap-1 mt-1 text-[10px] font-mono text-amber-400/90 group-hover/desc:text-amber-300 font-semibold">
                <span>{isDescriptionExpanded ? '▲ Menos ingredientes' : '▼ Receta completa'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between">
        {quantity > 0 ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 bg-[#1a1a20] rounded-xl p-1 border border-white/[0.08]">
              <button
                onClick={() => onRemove(product.id)}
                className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white flex items-center justify-center text-sm font-bold transition-colors"
              >
                -
              </button>
              <span className="w-8 text-center font-mono font-bold text-amber-400 text-sm">
                {quantity}
              </span>
              <button
                onClick={() => onAdd(product)}
                className="w-8 h-8 rounded-lg bg-amber-500 text-black flex items-center justify-center text-sm font-bold hover:bg-amber-400 transition-colors"
              >
                +
              </button>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono text-emerald-400 font-semibold block">
                ${(quantity * product.base_price).toFixed(2)} CAD
              </span>
              <button
                onClick={() => onCustomize(product.id)}
                className="text-[10px] text-amber-400/90 hover:text-amber-300 font-medium underline flex items-center gap-0.5 justify-end"
              >
                <span>Personalizar</span>
                <span>✎</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => onAdd(product)}
            className="w-full py-2.5 rounded-xl bg-white/[0.05] hover:bg-amber-500 hover:text-black border border-white/[0.08] hover:border-amber-500 text-xs font-semibold text-neutral-200 transition-all flex items-center justify-center gap-1.5"
          >
            <span>+ Agregar</span>
          </button>
        )}
      </div>
    </div>
  );
}
