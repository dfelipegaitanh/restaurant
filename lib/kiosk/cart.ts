import { Product } from '@/types/domain';

export interface ExtraOption {
  id: string;
  name: string;
  price: number;
  icon: string;
}

export interface ComboOption {
  id: string;
  name: string;
  basePrice: number;
  delta: number;
  icon: string;
}

export interface ComboItemConfig {
  sideId: string;
  drinkId: string;
}

export interface ItemModifiers {
  without: string[];
  extras: string[];
}

export interface CartEntry {
  product: Product;
  quantity: number;
}

export interface CartTotals {
  totalItems: number;
  subtotalAmount: number;
  totalComboDiscount: number;
  totalAmount: number;
}

export interface MainComboStats {
  totalMains: number;
  activeCombosCount: number;
  mainsWithoutComboCount: number;
}

export const COMBO_DISCOUNT_CAD = 1.5;

export const EXCLUSIONS_BY_CATEGORY: Record<string, string[]> = {
  burgers: ['Sin Cebolla', 'Sin Tomate', 'Sin Salsas', 'Sin Lechuga'],
  dogs: ['Sin Ripio de Papa', 'Sin Piña Calada', 'Sin Salsas', 'Sin Tocineta'],
  salchipapas: ['Sin Salsa Tártara', 'Sin Piña', 'Sin Hogao', 'Sin Suero'],
  default: ['Sin Salsas', 'Sin Cebolla'],
};

export const AVAILABLE_EXTRAS: ExtraOption[] = [
  { id: 'doble-queso', name: 'Doble Queso', price: 2.0, icon: '🧀' },
  { id: 'extra-tocineta', name: 'Extra Tocineta', price: 2.5, icon: '🥓' },
  { id: 'huevo-criollo', name: 'Huevo Criollo', price: 1.5, icon: '🍳' },
];

export const AVAILABLE_SIDES: ComboOption[] = [
  { id: 'papas-rusticas', name: 'Papas Rústicas', basePrice: 5.5, delta: 0, icon: '🍟' },
  { id: 'yucas-crocantes', name: 'Yucas Crocantes', basePrice: 6.5, delta: 1.0, icon: '🥢' },
  { id: 'arepitas-choclo', name: 'Arepitas de Choclo', basePrice: 6.0, delta: 0.5, icon: '🌽' },
  { id: 'empanaditas-criollas', name: 'Empanaditas Criollas', basePrice: 7.5, delta: 2.0, icon: '🥟' },
];

export const AVAILABLE_DRINKS: ComboOption[] = [
  { id: 'gaseosa-postobon', name: 'Gaseosa Postobón 355ml', basePrice: 3.5, delta: 0, icon: '🥤' },
  { id: 'limonada-panela', name: 'Limonada de Panela', basePrice: 5.0, delta: 1.5, icon: '🍋' },
  { id: 'soda-lulo', name: 'Soda de Lulo Artesanal', basePrice: 6.0, delta: 2.5, icon: '🍹' },
  { id: 'limonada-coco', name: 'Limonada de Coco & Cardamomo', basePrice: 6.5, delta: 3.0, icon: '🥥' },
  { id: 'malta-leche-condensada', name: 'Malta con Leche Cond.', basePrice: 4.5, delta: 1.0, icon: '🥛' },
];

export const DEFAULT_COMBO_CONFIG: ComboItemConfig = {
  sideId: 'papas-rusticas',
  drinkId: 'gaseosa-postobon',
};

/** Returns true when a category represents a main dish eligible for Combo Criollo. */
export function isMainDish(categoryId: string): boolean {
  return categoryId === 'burgers' || categoryId === 'dogs' || categoryId === 'salchipapas';
}

/** Counts main dishes currently in the cart alongside configured combo slots. */
export function computeMainComboStats(
  cart: Map<string, CartEntry>,
  combosByProduct: Map<string, ComboItemConfig[]>
): MainComboStats {
  let mains = 0;
  let combos = 0;

  for (const [prodId, entry] of cart.entries()) {
    if (isMainDish(entry.product.category_id)) {
      mains += entry.quantity;
      combos += (combosByProduct.get(prodId) || []).length;
    }
  }

  return {
    totalMains: mains,
    activeCombosCount: combos,
    mainsWithoutComboCount: Math.max(0, mains - combos),
  };
}

/** Computes total item count, gross subtotal, combo savings, and final CAD total. */
export function computeCartTotals(
  cart: Map<string, CartEntry>,
  combosByProduct: Map<string, ComboItemConfig[]>,
  itemModifiers: Map<string, ItemModifiers>
): CartTotals {
  let itemsCount = 0;
  let subtotal = 0;
  let comboDiscount = 0;

  for (const [prodId, entry] of cart.entries()) {
    const combos = isMainDish(entry.product.category_id) ? (combosByProduct.get(prodId) || []) : [];
    itemsCount += entry.quantity + combos.length * 2;

    const mods = itemModifiers.get(prodId);
    const extrasCost = (mods?.extras || []).reduce((sum, extraId) => {
      const extra = AVAILABLE_EXTRAS.find((e) => e.id === extraId);
      return sum + (extra?.price || 0);
    }, 0);

    subtotal += entry.quantity * (entry.product.base_price + extrasCost);

    for (const c of combos) {
      const side = AVAILABLE_SIDES.find((s) => s.id === c.sideId) || AVAILABLE_SIDES[0];
      const drink = AVAILABLE_DRINKS.find((d) => d.id === c.drinkId) || AVAILABLE_DRINKS[0];
      subtotal += side.basePrice + drink.basePrice;
      comboDiscount += COMBO_DISCOUNT_CAD;
    }
  }

  const finalAmount = Math.max(0, subtotal - comboDiscount);

  return {
    totalItems: itemsCount,
    subtotalAmount: Number(subtotal.toFixed(2)),
    totalComboDiscount: Number(comboDiscount.toFixed(2)),
    totalAmount: Number(finalAmount.toFixed(2)),
  };
}

/** Consolidates main items and attached combo side/drink selections into API order line items. */
export function buildOrderItemsPayload(
  cart: Map<string, CartEntry>,
  combosByProduct: Map<string, ComboItemConfig[]>
): Array<{ product_id: string; quantity: number }> {
  const consolidated = new Map<string, number>();

  for (const [prodId, entry] of cart.entries()) {
    consolidated.set(prodId, (consolidated.get(prodId) || 0) + entry.quantity);

    const combos = combosByProduct.get(prodId) || [];
    for (const c of combos) {
      consolidated.set(c.sideId, (consolidated.get(c.sideId) || 0) + 1);
      consolidated.set(c.drinkId, (consolidated.get(c.drinkId) || 0) + 1);
    }
  }

  return Array.from(consolidated.entries()).map(([product_id, quantity]) => ({
    product_id,
    quantity,
  }));
}
