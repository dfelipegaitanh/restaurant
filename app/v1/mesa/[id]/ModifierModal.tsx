'use client';

import React, { useEffect, useRef, useState, useId } from 'react';
import { Product, ModifierGroup, Modifier } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/formatters';

export interface SelectedModifier {
  modifier_id: string;
  name: string;
  price_delta: number;
  action_type: string;
}

export interface CartLineItem {
  line_id: string;
  product_id: string;
  product_name: string;
  base_price: number;
  unit_price: number;
  quantity: number;
  subtotal: number;
  modifiers: SelectedModifier[];
}

interface ModifierModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: CartLineItem) => void;
}

export default function ModifierModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
}: ModifierModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [selectedModifiers, setSelectedModifiers] = useState<Map<string, Set<string>>>(new Map());
  const [quantity, setQuantity] = useState(1);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (product && isOpen) {
      setQuantity(1);
      setValidationError(null);
      const initialMap = new Map<string, Set<string>>();

      for (const group of product.modifier_groups || []) {
        if (group.min_selection === 1 && group.max_selection === 1 && group.modifiers.length > 0) {
          initialMap.set(group.id, new Set([group.modifiers[0].id]));
        } else {
          initialMap.set(group.id, new Set());
        }
      }
      setSelectedModifiers(initialMap);
    }
  }, [product, isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Light dismiss fallback
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const isOutside = (e: MouseEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };

    let pressedOutside = false;

    const handlePointerDown = (e: MouseEvent) => {
      pressedOutside = isOutside(e);
    };

    const handlePointerUp = (e: MouseEvent) => {
      if (pressedOutside && isOutside(e)) {
        onClose();
      }
      pressedOutside = false;
    };

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('mousedown', handlePointerDown);
    dialog.addEventListener('mouseup', handlePointerUp);
    dialog.addEventListener('cancel', handleCancel);

    return () => {
      dialog.removeEventListener('mousedown', handlePointerDown);
      dialog.removeEventListener('mouseup', handlePointerUp);
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);

  if (!product) return null;

  const handleToggleModifier = (group: ModifierGroup, mod: Modifier) => {
    setSelectedModifiers((prev) => {
      const next = new Map(prev);
      const currentSet = new Set(next.get(group.id) || []);

      if (group.max_selection === 1) {
        currentSet.clear();
        currentSet.add(mod.id);
      } else {
        if (currentSet.has(mod.id)) {
          currentSet.delete(mod.id);
        } else {
          if (currentSet.size < group.max_selection) {
            currentSet.add(mod.id);
          }
        }
      }

      next.set(group.id, currentSet);
      return next;
    });
  };

  let modifierSurcharges = 0;
  const flatSelectedMods: SelectedModifier[] = [];

  for (const group of product.modifier_groups || []) {
    const selectedSet = selectedModifiers.get(group.id);
    if (!selectedSet) continue;
    for (const mod of group.modifiers) {
      if (selectedSet.has(mod.id)) {
        modifierSurcharges += mod.price_delta;
        flatSelectedMods.push({
          modifier_id: mod.id,
          name: mod.name,
          price_delta: mod.price_delta,
          action_type: mod.action_type,
        });
      }
    }
  }

  const unitPrice = product.base_price + modifierSurcharges;
  const totalPrice = unitPrice * quantity;

  const validateConstraints = (): string | null => {
    for (const group of product.modifier_groups || []) {
      const count = selectedModifiers.get(group.id)?.size || 0;
      if (count < group.min_selection) {
        return `Por favor seleccione al menos ${group.min_selection} opción en "${group.name}".`;
      }
      if (count > group.max_selection) {
        return `No puede seleccionar más de ${group.max_selection} opciones en "${group.name}".`;
      }
    }
    return null;
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateConstraints();
    if (error) {
      setValidationError(error);
      return;
    }

    const modIds = flatSelectedMods.map((m) => m.modifier_id).sort();
    const lineId = `${product.id}:${modIds.join(',')}`;

    onAddToCart({
      line_id: lineId,
      product_id: product.id,
      product_name: product.name,
      base_price: product.base_price,
      unit_price: unitPrice,
      quantity,
      subtotal: totalPrice,
      modifiers: flatSelectedMods,
    });

    onClose();
  };

  const error = validateConstraints();

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as any)}
      aria-labelledby={titleId}
      className="m-auto bg-[#121216] text-neutral-200 rounded-2xl p-0 max-w-lg w-full border border-white/[0.08] shadow-2xl overflow-hidden"
      style={{
        overscrollBehavior: 'contain',
      }}
    >
      <form onSubmit={handleConfirm} method="dialog" className="flex flex-col max-h-[88vh]">
        {/* Header */}
        <header className="px-6 py-5 border-b border-white/[0.06] flex items-start justify-between sticky top-0 bg-[#121216]/95 backdrop-blur z-10">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400">Personalización</span>
            <h2 id={titleId} className="text-xl font-serif font-normal text-white">
              {product.name}
            </h2>
            <p className="text-xs font-mono text-neutral-400">
              Base: {formatCurrency(product.base_price)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-neutral-400 hover:text-white hover:bg-white/[0.06] transition"
          >
            ✕
          </button>
        </header>

        {/* Scrollable Modifier Groups */}
        <div className="px-6 py-5 overflow-y-auto space-y-6 flex-1">
          {product.description && (
            <p className="text-xs text-neutral-400 leading-relaxed font-light p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              {product.description}
            </p>
          )}

          {product.modifier_groups && product.modifier_groups.length > 0 ? (
            product.modifier_groups.map((group) => {
              const selectedSet = selectedModifiers.get(group.id) || new Set();
              const isSingle = group.max_selection === 1;
              const isRequired = group.min_selection > 0;
              const isMaxReached = !isSingle && selectedSet.size >= group.max_selection;

              return (
                <fieldset key={group.id} className="space-y-2.5">
                  <legend className="flex items-center justify-between w-full text-xs font-mono tracking-wider text-neutral-400 uppercase">
                    <span>
                      {group.name}{' '}
                      {isRequired ? (
                        <span className="text-amber-400 text-[10px] ml-1 font-bold">
                          *(requerido)
                        </span>
                      ) : (
                        <span className="text-neutral-500 text-[10px] ml-1">
                          (opcional)
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono">
                      {isSingle ? 'Elige 1' : `Máx ${group.max_selection}`}
                    </span>
                  </legend>

                  <div className="grid grid-cols-1 gap-2">
                    {group.modifiers.map((mod) => {
                      const isSelected = selectedSet.has(mod.id);
                      const isDisabled = !isSelected && isMaxReached;

                      return (
                        <label
                          key={mod.id}
                          className={`flex items-center justify-between p-3.5 rounded-xl border min-h-[48px] cursor-pointer transition select-none ${
                            isSelected
                              ? 'border-amber-500/50 bg-amber-500/10 text-white'
                              : isDisabled
                              ? 'border-white/[0.02] bg-white/[0.01] text-neutral-600 cursor-not-allowed'
                              : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-neutral-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type={isSingle ? 'radio' : 'checkbox'}
                              name={`group-${group.id}`}
                              checked={isSelected}
                              disabled={isDisabled}
                              onChange={() => handleToggleModifier(group, mod)}
                              className="w-4 h-4 accent-amber-500 cursor-pointer min-w-[16px] min-h-[16px]"
                            />
                            <span className="text-xs font-medium">{mod.name}</span>
                          </div>

                          <span className="text-xs font-mono font-medium text-amber-300/90">
                            {mod.price_delta > 0
                              ? `+${formatCurrency(mod.price_delta)}`
                              : 'Incluido'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })
          ) : (
            <p className="text-xs text-neutral-500 py-4 text-center font-mono">
              Este plato no requiere personalización adicional.
            </p>
          )}

          {/* Quantity Selector */}
          <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-xs font-mono text-neutral-400 uppercase tracking-wider">Cantidad</span>
            <div className="flex items-center gap-3 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Disminuir cantidad"
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] text-neutral-300 text-sm font-mono disabled:opacity-30 hover:bg-white/[0.08] transition active:scale-95"
              >
                -
              </button>
              <span className="w-6 text-center font-mono text-sm text-white">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Aumentar cantidad"
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] text-neutral-300 text-sm font-mono hover:bg-white/[0.08] transition active:scale-95"
              >
                +
              </button>
            </div>
          </div>

          {validationError && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-red-300 text-xs font-mono">
              {validationError}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <footer className="p-5 border-t border-white/[0.06] bg-[#0f0f13] flex items-center justify-between sticky bottom-0 z-10">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Subtotal</p>
            <p className="text-xl font-serif font-medium text-amber-300">
              {formatCurrency(totalPrice)}
            </p>
          </div>
          <button
            type="submit"
            disabled={!!error}
            className={`min-h-[46px] px-6 py-2.5 rounded-xl text-xs font-medium tracking-wide flex items-center justify-center gap-2 transition active:scale-95 ${
              error
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed opacity-50'
                : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold shadow-md shadow-amber-500/20'
            }`}
          >
            <span>Agregar a la Orden</span>
            <span>&rarr;</span>
          </button>
        </footer>
      </form>
    </dialog>
  );
}
