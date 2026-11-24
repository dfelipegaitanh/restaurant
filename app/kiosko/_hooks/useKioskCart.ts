'use client';

import { useState, useMemo, useCallback } from 'react';
import { Product } from '@/types/domain';
import {
  CartEntry,
  ComboItemConfig,
  DEFAULT_COMBO_CONFIG,
  ItemModifiers,
  computeCartTotals,
  computeMainComboStats,
} from '@/lib/kiosk/cart';

export interface SwapPickerTarget {
  productId: string;
  comboIndex: number;
  type: 'side' | 'drink';
}

/** Manages kiosk cart items, per-unit combo slots, ingredient modifiers, and derived CAD totals. */
export function useKioskCart() {
  const [cart, setCart] = useState<Map<string, CartEntry>>(new Map());
  const [itemModifiers, setItemModifiers] = useState<Map<string, ItemModifiers>>(new Map());
  const [combosByProduct, setCombosByProduct] = useState<Map<string, ComboItemConfig[]>>(new Map());
  const [customizingProductId, setCustomizingProductId] = useState<string | null>(null);
  const [openSwapPicker, setOpenSwapPicker] = useState<SwapPickerTarget | null>(null);

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      next.set(product.id, {
        product,
        quantity: existing ? existing.quantity + 1 : 1,
      });
      return next;
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (!existing) return next;

      if (existing.quantity > 1) {
        const newQty = existing.quantity - 1;
        next.set(productId, { product: existing.product, quantity: newQty });

        setCombosByProduct((cPrev) => {
          const currentCombos = cPrev.get(productId);
          if (!currentCombos || currentCombos.length <= newQty) return cPrev;
          const cNext = new Map(cPrev);
          cNext.set(productId, currentCombos.slice(0, newQty));
          return cNext;
        });
      } else {
        next.delete(productId);
        setCombosByProduct((cPrev) => {
          if (!cPrev.has(productId)) return cPrev;
          const cNext = new Map(cPrev);
          cNext.delete(productId);
          return cNext;
        });
        setItemModifiers((mPrev) => {
          if (!mPrev.has(productId)) return mPrev;
          const mNext = new Map(mPrev);
          mNext.delete(productId);
          return mNext;
        });
      }
      return next;
    });
  }, []);

  const deleteFromCart = useCallback((productId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
    setItemModifiers((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
    setCombosByProduct((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
    setOpenSwapPicker((prev) => (prev?.productId === productId ? null : prev));
  }, []);

  const clearAll = useCallback(() => {
    setCart(new Map());
    setItemModifiers(new Map());
    setCombosByProduct(new Map());
    setCustomizingProductId(null);
    setOpenSwapPicker(null);
  }, []);

  const addComboToProduct = useCallback(
    (productId: string) => {
      const entry = cart.get(productId);
      if (!entry) return;

      setCombosByProduct((prev) => {
        const current = prev.get(productId) || [];
        if (current.length >= entry.quantity) return prev;
        const next = new Map(prev);
        next.set(productId, [...current, { ...DEFAULT_COMBO_CONFIG }]);
        return next;
      });
    },
    [cart]
  );

  const removeComboFromProduct = useCallback((productId: string, comboIndex: number) => {
    setCombosByProduct((prev) => {
      const current = prev.get(productId) || [];
      const updated = current.filter((_, idx) => idx !== comboIndex);
      const next = new Map(prev);
      if (updated.length === 0) {
        next.delete(productId);
      } else {
        next.set(productId, updated);
      }
      return next;
    });
    setOpenSwapPicker((prev) =>
      prev?.productId === productId && prev.comboIndex === comboIndex ? null : prev
    );
  }, []);

  const replicateComboToAll = useCallback(
    (productId: string) => {
      const entry = cart.get(productId);
      if (!entry) return;

      setCombosByProduct((prev) => {
        const current = prev.get(productId) || [];
        const template = current[0] || DEFAULT_COMBO_CONFIG;
        const replicated: ComboItemConfig[] = Array.from({ length: entry.quantity }, () => ({
          ...template,
        }));
        const next = new Map(prev);
        next.set(productId, replicated);
        return next;
      });
    },
    [cart]
  );

  const updateComboSlotField = useCallback(
    (productId: string, comboIndex: number, field: keyof ComboItemConfig, value: string) => {
      setCombosByProduct((prev) => {
        const current = prev.get(productId);
        if (!current || !current[comboIndex]) return prev;
        const updated = [...current];
        updated[comboIndex] = { ...updated[comboIndex], [field]: value };
        const next = new Map(prev);
        next.set(productId, updated);
        return next;
      });
    },
    []
  );

  const toggleExclusion = useCallback((productId: string, exclusion: string) => {
    setItemModifiers((prev) => {
      const next = new Map(prev);
      const current = next.get(productId) || { without: [], extras: [] };
      const without = current.without.includes(exclusion)
        ? current.without.filter((w) => w !== exclusion)
        : [...current.without, exclusion];
      next.set(productId, { ...current, without });
      return next;
    });
  }, []);

  const toggleExtra = useCallback((productId: string, extraId: string) => {
    setItemModifiers((prev) => {
      const next = new Map(prev);
      const current = next.get(productId) || { without: [], extras: [] };
      const extras = current.extras.includes(extraId)
        ? current.extras.filter((e) => e !== extraId)
        : [...current.extras, extraId];
      next.set(productId, { ...current, extras });
      return next;
    });
  }, []);

  const comboStats = useMemo(
    () => computeMainComboStats(cart, combosByProduct),
    [cart, combosByProduct]
  );

  const totals = useMemo(
    () => computeCartTotals(cart, combosByProduct, itemModifiers),
    [cart, combosByProduct, itemModifiers]
  );

  return {
    cart,
    itemModifiers,
    combosByProduct,
    customizingProductId,
    setCustomizingProductId,
    openSwapPicker,
    setOpenSwapPicker,
    addToCart,
    removeFromCart,
    deleteFromCart,
    clearAll,
    addComboToProduct,
    removeComboFromProduct,
    replicateComboToAll,
    updateComboSlotField,
    toggleExclusion,
    toggleExtra,
    comboStats,
    totals,
  };
}
