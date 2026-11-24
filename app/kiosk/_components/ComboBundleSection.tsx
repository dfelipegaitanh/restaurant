'use client';

import React from 'react';
import {
  AVAILABLE_DRINKS,
  AVAILABLE_SIDES,
  COMBO_DISCOUNT_CAD,
  ComboItemConfig,
  ComboOption,
} from '@/lib/kiosk/cart';
import { SwapPickerTarget } from '../_hooks/useKioskCart';

interface SwapPickerFieldProps {
  label: string;
  icon: string;
  pickerHeader: string;
  dropdownWidthClass: string;
  options: ComboOption[];
  selectedOption: ComboOption;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (optionId: string) => void;
}

function SwapPickerField({
  label,
  icon,
  pickerHeader,
  dropdownWidthClass,
  options,
  selectedOption,
  isOpen,
  onToggle,
  onSelect,
}: SwapPickerFieldProps) {
  return (
    <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.04]">
      <span className="text-neutral-400 font-mono text-[10px] flex items-center gap-1.5">
        <span>{icon}</span> {label}:
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          className="text-[11px] font-medium text-white hover:text-amber-300 flex items-center gap-1.5 bg-[#1a1a24] hover:bg-[#222230] px-2.5 py-1 rounded-lg border border-white/[0.08] transition-all"
        >
          <span>{selectedOption.name}</span>
          {selectedOption.delta > 0 && (
            <span className="text-amber-400 font-mono text-[10px]">
              (+${selectedOption.delta.toFixed(2)})
            </span>
          )}
          <span className="text-[9px] text-neutral-400">▾</span>
        </button>

        {isOpen && (
          <div
            className={`absolute right-0 top-full mt-1.5 z-40 ${dropdownWidthClass} bg-[#16161e] border border-amber-500/40 rounded-xl p-1.5 shadow-2xl space-y-1`}
          >
            <div className="px-2 py-1 text-[10px] font-mono text-neutral-400 uppercase tracking-wider border-b border-white/[0.06]">
              {pickerHeader}
            </div>
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelect(opt.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                  selectedOption.id === opt.id
                    ? 'bg-amber-500 text-black font-bold'
                    : 'text-neutral-300 hover:bg-white/[0.08]'
                }`}
              >
                <span>
                  {opt.icon} {opt.name}
                </span>
                <span className="font-mono text-[10px]">
                  {opt.delta > 0 ? `+$${opt.delta.toFixed(2)} CAD` : 'Incluido'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ComboBundleSectionProps {
  productId: string;
  quantity: number;
  combos: ComboItemConfig[];
  openSwapPicker: SwapPickerTarget | null;
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
}

/** Manages per-unit Combo Criollo slots with side/drink swaps and bulk replication. */
export function ComboBundleSection({
  productId,
  quantity,
  combos,
  openSwapPicker,
  onAddCombo,
  onRemoveCombo,
  onReplicateCombo,
  onSetSwapPicker,
  onUpdateComboField,
}: ComboBundleSectionProps) {
  if (combos.length === 0) {
    return (
      <div className="pt-2 border-t border-white/[0.04] space-y-2.5">
        <button
          type="button"
          onClick={() => onAddCombo(productId)}
          className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between transition-all group"
        >
          <span className="flex items-center gap-2">
            <span>🍟🥤</span>
            <span>
              {quantity > 1
                ? '¿Armar Combo Criollo para este plato?'
                : '¿Volver Combo Criollo para este plato?'}
            </span>
          </span>
          <span className="font-mono text-[11px] bg-amber-500/20 px-2 py-0.5 rounded-full text-amber-200 group-hover:bg-amber-500 group-hover:text-black transition-colors">
            +$7.50 CAD c/u
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="pt-2 border-t border-white/[0.04] space-y-2.5">
      <div className="bg-[#0f0f14] border border-emerald-500/30 rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <span className="text-emerald-400">✓</span>{' '}
              {quantity > 1
                ? `${combos.length} de ${quantity} platos con Combo Criollo`
                : 'Combo Criollo Asignado'}
            </span>
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
              -${(combos.length * COMBO_DISCOUNT_CAD).toFixed(2)} CAD Ahorro
            </span>
          </div>

          {quantity > 1 && combos.length < quantity && (
            <button
              type="button"
              onClick={() => onReplicateCombo(productId)}
              className="text-[10px] font-mono text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 transition-all font-semibold flex items-center gap-1"
            >
              <span>⚡ Replicar a todos</span>
            </button>
          )}
        </div>

        <div className="space-y-2">
          {combos.map((c, idx) => {
            const currentSide =
              AVAILABLE_SIDES.find((s) => s.id === c.sideId) || AVAILABLE_SIDES[0];
            const currentDrink =
              AVAILABLE_DRINKS.find((d) => d.id === c.drinkId) || AVAILABLE_DRINKS[0];
            const isSideOpen =
              openSwapPicker?.productId === productId &&
              openSwapPicker.comboIndex === idx &&
              openSwapPicker.type === 'side';
            const isDrinkOpen =
              openSwapPicker?.productId === productId &&
              openSwapPicker.comboIndex === idx &&
              openSwapPicker.type === 'drink';

            return (
              <div
                key={idx}
                className="bg-[#14141c] border border-white/[0.08] rounded-xl p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] text-amber-300 font-bold">
                    {quantity > 1 ? `Plato #${idx + 1}:` : 'Componentes del Combo:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveCombo(productId, idx)}
                    className="text-[10px] font-mono text-red-400/80 hover:text-red-300 underline"
                  >
                    Quitar combo
                  </button>
                </div>

                <SwapPickerField
                  label="Acompañamiento"
                  icon="🍟"
                  pickerHeader="Elige acompañamiento:"
                  dropdownWidthClass="w-60"
                  options={AVAILABLE_SIDES}
                  selectedOption={currentSide}
                  isOpen={isSideOpen}
                  onToggle={() =>
                    onSetSwapPicker(
                      isSideOpen ? null : { productId, comboIndex: idx, type: 'side' }
                    )
                  }
                  onSelect={(optionId) => {
                    onUpdateComboField(productId, idx, 'sideId', optionId);
                    onSetSwapPicker(null);
                  }}
                />

                <SwapPickerField
                  label="Bebida"
                  icon="🥤"
                  pickerHeader="Elige bebida:"
                  dropdownWidthClass="w-64"
                  options={AVAILABLE_DRINKS}
                  selectedOption={currentDrink}
                  isOpen={isDrinkOpen}
                  onToggle={() =>
                    onSetSwapPicker(
                      isDrinkOpen ? null : { productId, comboIndex: idx, type: 'drink' }
                    )
                  }
                  onSelect={(optionId) => {
                    onUpdateComboField(productId, idx, 'drinkId', optionId);
                    onSetSwapPicker(null);
                  }}
                />
              </div>
            );
          })}
        </div>

        {combos.length < quantity && (
          <button
            type="button"
            onClick={() => onAddCombo(productId)}
            className="w-full py-2 px-3 rounded-xl border border-dashed border-amber-500/40 hover:border-amber-500/80 hover:bg-amber-500/[0.04] text-amber-300 text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all"
          >
            <span>+ Armar Combo para Plato #{combos.length + 1}</span>
            <span className="text-[11px] opacity-80">(+$7.50 CAD)</span>
          </button>
        )}
      </div>
    </div>
  );
}
