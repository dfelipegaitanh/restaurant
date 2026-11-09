'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { CategoryWithProducts, Product, OrderSummary } from '@/types/domain';

const EXCLUSIONS_BY_CATEGORY: Record<string, string[]> = {
  burgers: ['Sin Cebolla', 'Sin Tomate', 'Sin Salsas', 'Sin Lechuga'],
  dogs: ['Sin Ripio de Papa', 'Sin Piña Calada', 'Sin Salsas', 'Sin Tocineta'],
  salchipapas: ['Sin Salsa Tártara', 'Sin Piña', 'Sin Hogao', 'Sin Suero'],
  default: ['Sin Salsas', 'Sin Cebolla'],
};

const AVAILABLE_EXTRAS = [
  { id: 'doble-queso', name: 'Doble Queso', price: 2.00, icon: '🧀' },
  { id: 'extra-tocineta', name: 'Extra Tocineta', price: 2.50, icon: '🥓' },
  { id: 'huevo-criollo', name: 'Huevo Criollo', price: 1.50, icon: '🍳' },
];

const AVAILABLE_SIDES = [
  { id: 'papas-rusticas', name: 'Papas Rústicas', basePrice: 5.50, delta: 0, icon: '🍟' },
  { id: 'yucas-crocantes', name: 'Yucas Crocantes', basePrice: 6.50, delta: 1.00, icon: '🥢' },
  { id: 'arepitas-choclo', name: 'Arepitas de Choclo', basePrice: 6.00, delta: 0.50, icon: '🌽' },
  { id: 'empanaditas-criollas', name: 'Empanaditas Criollas', basePrice: 7.50, delta: 2.00, icon: '🥟' },
];

const AVAILABLE_DRINKS = [
  { id: 'gaseosa-postobon', name: 'Gaseosa Postobón 355ml', basePrice: 3.50, delta: 0, icon: '🥤' },
  { id: 'limonada-panela', name: 'Limonada de Panela', basePrice: 5.00, delta: 1.50, icon: '🍋' },
  { id: 'soda-lulo', name: 'Soda de Lulo Artesanal', basePrice: 6.00, delta: 2.50, icon: '🍹' },
  { id: 'limonada-coco', name: 'Limonada de Coco & Cardamomo', basePrice: 6.50, delta: 3.00, icon: '🥥' },
  { id: 'malta-leche-condensada', name: 'Malta con Leche Cond.', basePrice: 4.50, delta: 1.00, icon: '🥛' },
];

export default function KioskPage() {
  const [categories, setCategories] = useState<CategoryWithProducts[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('burgers');
  const [cart, setCart] = useState<Map<string, { product: Product; quantity: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderSummary | null>(null);
  const [countdown, setCountdown] = useState<number>(6);
  const [customerName, setCustomerName] = useState<string>('');
  const [nameError, setNameError] = useState(false);

  // Drawer, Customizer, and Hierarchical Combo States
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [itemModifiers, setItemModifiers] = useState<Map<string, { without: string[]; extras: string[] }>>(new Map());
  const [customizingProductId, setCustomizingProductId] = useState<string | null>(null);

  // Bundle Padre-Hijo: Map<productId, { sideId: string, drinkId: string }>
  const [combosByProduct, setCombosByProduct] = useState<Map<string, { sideId: string; drinkId: string }>>(new Map());
  const [openSwapPicker, setOpenSwapPicker] = useState<{ productId: string; type: 'side' | 'drink' } | null>(null);

  // Fetch catalog from /api/menu with Live Auto-Reload
  const loadMenu = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await fetch('/api/menu', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.categories)) {
        setCategories(data.categories);
        setActiveCategoryId((prev) => {
          const exists = data.categories.some((c: CategoryWithProducts) => c.id === prev);
          return exists ? prev : data.categories[0]?.id || 'burgers';
        });
      }
    } catch (err) {
      console.error('Error fetching menu:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // Hydration & Real-time Auto-Reload (SSE + Polling + Window Focus)
  useEffect(() => {
    loadMenu(true);

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');
      es.addEventListener('CATALOG_UPDATED', () => {
        loadMenu(false);
      });
    } catch (e) {
      console.warn('SSE connection error in kiosk:', e);
    }

    const pollInterval = setInterval(() => {
      loadMenu(false);
    }, 3000);

    const onFocus = () => loadMenu(false);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadMenu(false);
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (es) es.close();
      clearInterval(pollInterval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadMenu]);

  // Auto-reset countdown when order is confirmed
  useEffect(() => {
    if (!confirmedOrder) return;
    setCountdown(6);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setConfirmedOrder(null);
          setCart(new Map());
          setItemModifiers(new Map());
          setCombosByProduct(new Map());
          setCustomerName('');
          setNameError(false);
          setIsCartDrawerOpen(false);
          return 6;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [confirmedOrder]);

  // Cart operations
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      if (existing) {
        next.set(product.id, { product, quantity: existing.quantity + 1 });
      } else {
        next.set(product.id, { product, quantity: 1 });
      }
      return next;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId);
      if (!existing) return next;
      if (existing.quantity > 1) {
        next.set(productId, { product: existing.product, quantity: existing.quantity - 1 });
      } else {
        next.delete(productId);
        // Also cleanup combo and modifiers if last item removed
        setCombosByProduct((cPrev) => {
          const cNext = new Map(cPrev);
          cNext.delete(productId);
          return cNext;
        });
        setItemModifiers((mPrev) => {
          const mNext = new Map(mPrev);
          mNext.delete(productId);
          return mNext;
        });
      }
      return next;
    });
  };

  const deleteFromCart = (productId: string) => {
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
    if (openSwapPicker?.productId === productId) {
      setOpenSwapPicker(null);
    }
  };

  const clearCart = () => {
    setCart(new Map());
    setItemModifiers(new Map());
    setCombosByProduct(new Map());
    setOpenSwapPicker(null);
    setIsCartDrawerOpen(false);
  };

  // Combo Bundle Operations
  const toggleComboForMain = (productId: string) => {
    setCombosByProduct((prev) => {
      const next = new Map(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.set(productId, { sideId: 'papas-rusticas', drinkId: 'gaseosa-postobon' });
      }
      return next;
    });
  };

  const updateComboSide = (productId: string, sideId: string) => {
    setCombosByProduct((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId) || { sideId: 'papas-rusticas', drinkId: 'gaseosa-postobon' };
      next.set(productId, { ...existing, sideId });
      return next;
    });
  };

  const updateComboDrink = (productId: string, drinkId: string) => {
    setCombosByProduct((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId) || { sideId: 'papas-rusticas', drinkId: 'gaseosa-postobon' };
      next.set(productId, { ...existing, drinkId });
      return next;
    });
  };

  // Modifier toggles
  const toggleExclusion = (productId: string, exclusion: string) => {
    setItemModifiers((prev) => {
      const next = new Map(prev);
      const current = next.get(productId) || { without: [], extras: [] };
      const without = current.without.includes(exclusion)
        ? current.without.filter((w) => w !== exclusion)
        : [...current.without, exclusion];
      next.set(productId, { ...current, without });
      return next;
    });
  };

  const toggleExtra = (productId: string, extraId: string) => {
    setItemModifiers((prev) => {
      const next = new Map(prev);
      const current = next.get(productId) || { without: [], extras: [] };
      const extras = current.extras.includes(extraId)
        ? current.extras.filter((e) => e !== extraId)
        : [...current.extras, extraId];
      next.set(productId, { ...current, extras });
      return next;
    });
  };

  const toggleExpandDescription = (productId: string) => {
    setExpandedDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  // Main dishes count & combos count
  const { totalMains, activeCombosCount, mainsWithoutComboCount } = useMemo(() => {
    let mains = 0;
    let combos = 0;
    for (const [prodId, entry] of cart.entries()) {
      if (entry.product.category_id === 'burgers' || entry.product.category_id === 'dogs') {
        mains += entry.quantity;
        if (combosByProduct.has(prodId)) {
          combos += entry.quantity;
        }
      }
    }
    return {
      totalMains: mains,
      activeCombosCount: combos,
      mainsWithoutComboCount: Math.max(0, mains - combos),
    };
  }, [cart, combosByProduct]);

  // Cart Computations (Hierarchical Bundling Math)
  const { totalItems, subtotalAmount, totalComboDiscount, totalAmount } = useMemo(() => {
    let itemsCount = 0;
    let subtotal = 0;
    let comboDiscount = 0;

    for (const [prodId, entry] of cart.entries()) {
      const isMain = entry.product.category_id === 'burgers' || entry.product.category_id === 'dogs';
      const combo = isMain ? combosByProduct.get(prodId) : null;

      // Item count: main dish + combo items
      itemsCount += entry.quantity * (combo ? 3 : 1);

      // Extras cost (modifiers)
      const mods = itemModifiers.get(prodId);
      const extrasCost = (mods?.extras || []).reduce((sum, extraId) => {
        const extra = AVAILABLE_EXTRAS.find((e) => e.id === extraId);
        return sum + (extra?.price || 0);
      }, 0);

      // Base price of main dish
      subtotal += entry.quantity * (entry.product.base_price + extrasCost);

      // If combo is active on this dish
      if (combo) {
        const side = AVAILABLE_SIDES.find((s) => s.id === combo.sideId) || AVAILABLE_SIDES[0];
        const drink = AVAILABLE_DRINKS.find((d) => d.id === combo.drinkId) || AVAILABLE_DRINKS[0];

        subtotal += entry.quantity * (side.basePrice + drink.basePrice);
        comboDiscount += entry.quantity * 1.50; // $1.50 CAD per combo
      }
    }

    const finalAmount = Math.max(0, subtotal - comboDiscount);

    return {
      totalItems: itemsCount,
      subtotalAmount: Number(subtotal.toFixed(2)),
      totalComboDiscount: Number(comboDiscount.toFixed(2)),
      totalAmount: Number(finalAmount.toFixed(2)),
    };
  }, [cart, combosByProduct, itemModifiers]);

  // Submit order with consolidated payload
  const handleConfirmOrder = async () => {
    if (cart.size === 0 || submitting) return;

    const trimmedName = customerName.trim();
    if (!trimmedName) {
      setNameError(true);
      return;
    }
    setNameError(false);

    setSubmitting(true);
    const idempotencyKey = crypto.randomUUID();

    // Consolidate all dishes + combo sub-items
    const consolidated = new Map<string, number>();

    for (const [prodId, entry] of cart.entries()) {
      consolidated.set(prodId, (consolidated.get(prodId) || 0) + entry.quantity);

      const combo = combosByProduct.get(prodId);
      if (combo) {
        consolidated.set(combo.sideId, (consolidated.get(combo.sideId) || 0) + entry.quantity);
        consolidated.set(combo.drinkId, (consolidated.get(combo.drinkId) || 0) + entry.quantity);
      }
    }

    const itemsPayload = Array.from(consolidated.entries()).map(([product_id, quantity]) => ({
      product_id,
      quantity,
    }));

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          customer_name: trimmedName,
          items: itemsPayload,
        }),
      });

      const json = await res.json();
      if (json.success && json.order) {
        setConfirmedOrder(json.order);
        setIsCartDrawerOpen(false);
      } else {
        alert(`Error al procesar la orden: ${json.error || 'Intenta de nuevo'}`);
      }
    } catch (err: any) {
      console.error(err);
      alert('Error de conexión con el kiosko');
    } finally {
      setSubmitting(false);
    }
  };

  const activeCategory = categories.find((c) => c.id === activeCategoryId);

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 flex flex-col font-sans select-none selection:bg-amber-500/20">
      {/* Top Header */}
      <header className="border-b border-white/[0.08] bg-[#0c0c0e]/95 backdrop-blur-xl px-6 py-4 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-serif font-bold text-lg hover:bg-amber-500/20 transition-all"
          >
            B
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">Kiosko de Autoservicio</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                Pide Aquí
              </span>
            </div>
            <p className="text-xs text-neutral-400">Toca los platos para añadirlos • Precios en CAD</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/cocina"
            className="text-xs font-mono text-neutral-400 hover:text-amber-300 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] transition-all"
          >
            Ver Cocina KDS →
          </Link>
        </div>
      </header>

      {/* Main Kiosk Layout */}
      <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-4 py-4 pb-36">
        {/* Category Horizontal Navigation */}
        <nav className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-white/[0.06] no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`px-5 py-3 rounded-2xl text-xs md:text-sm font-semibold tracking-wide transition-all whitespace-nowrap flex items-center gap-2 ${
                activeCategoryId === cat.id
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 scale-[1.02]'
                  : 'bg-[#141418] text-neutral-300 hover:bg-[#1a1a20] hover:text-white border border-white/[0.06]'
              }`}
            >
              <span>{cat.name}</span>
              <span
                className={`text-[11px] font-mono px-1.5 py-0.5 rounded-full ${
                  activeCategoryId === cat.id ? 'bg-black/20 text-black' : 'bg-white/[0.06] text-neutral-400'
                }`}
              >
                {cat.products.length}
              </span>
            </button>
          ))}
        </nav>

        {/* Product Cards Grid */}
        <main className="flex-1 pt-4">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-neutral-500 font-mono text-sm">
              Cargando menú criollo...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeCategory?.products.map((prod) => {
                const cartEntry = cart.get(prod.id);
                const quantity = cartEntry?.quantity || 0;
                const isExpanded = expandedDescriptions.has(prod.id);
                const hasComboAttached = combosByProduct.has(prod.id);

                return (
                  <div
                    key={prod.id}
                    className={`group relative bg-[#121216] rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                      quantity > 0
                        ? 'border-amber-500/50 bg-gradient-to-b from-amber-500/[0.06] to-[#121216] shadow-xl shadow-amber-500/5'
                        : 'border-white/[0.06] hover:border-white/[0.15]'
                    }`}
                  >
                    <div>
                      {/* Product Visual Header */}
                      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-[#181820] mb-3.5 border border-white/[0.06]">
                        {prod.image_url && prod.image_url.startsWith('/') ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-white/[0.04] to-transparent text-5xl">
                            <span>{prod.image_url || '🍽️'}</span>
                          </div>
                        )}
                        {/* Floating Price Badge */}
                        <div className="absolute top-3 right-3 bg-black/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/[0.12] shadow-lg">
                          <span className="text-sm font-bold text-amber-300 font-mono">
                            ${prod.base_price.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-neutral-400 font-mono ml-1">CAD</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-base font-bold text-white group-hover:text-amber-200 transition-colors leading-snug">
                            {prod.name}
                          </h3>
                          {hasComboAttached && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold whitespace-nowrap">
                              Combo
                            </span>
                          )}
                        </div>

                        {/* Expandable Recipe Description (Hover & Tap Toggle) */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpandDescription(prod.id);
                          }}
                          className="cursor-pointer group/desc relative"
                          title="Toca para fijar u ocultar la receta completa"
                        >
                          <p
                            className={`text-xs text-neutral-400 leading-relaxed font-light transition-all duration-200 group-hover/desc:text-neutral-200 ${
                              isExpanded
                                ? 'line-clamp-none text-neutral-200'
                                : 'line-clamp-2 group-hover/desc:line-clamp-none'
                            }`}
                          >
                            {prod.description}
                          </p>
                          {prod.description && prod.description.length > 70 && (
                            <div className="flex items-center gap-1 mt-1 text-[10px] font-mono text-amber-400/90 group-hover/desc:text-amber-300 font-semibold">
                              <span>{isExpanded ? '▲ Menos ingredientes' : '▼ Receta completa'}</span>
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
                              onClick={() => removeFromCart(prod.id)}
                              className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white flex items-center justify-center text-sm font-bold transition-colors"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-mono font-bold text-amber-400 text-sm">
                              {quantity}
                            </span>
                            <button
                              onClick={() => addToCart(prod)}
                              className="w-8 h-8 rounded-lg bg-amber-500 text-black flex items-center justify-center text-sm font-bold hover:bg-amber-400 transition-colors"
                            >
                              +
                            </button>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono text-emerald-400 font-semibold block">
                              ${(quantity * prod.base_price).toFixed(2)} CAD
                            </span>
                            <button
                              onClick={() => {
                                setCustomizingProductId(prod.id);
                                setIsCartDrawerOpen(true);
                              }}
                              className="text-[10px] text-amber-400/90 hover:text-amber-300 font-medium underline flex items-center gap-0.5 justify-end"
                            >
                              <span>Personalizar</span>
                              <span>✎</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(prod)}
                          className="w-full py-2.5 rounded-xl bg-white/[0.05] hover:bg-amber-500 hover:text-black border border-white/[0.08] hover:border-amber-500 text-xs font-semibold text-neutral-200 transition-all flex items-center justify-center gap-1.5"
                        >
                          <span>+ Agregar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Floating Bottom Order Bar */}
      {cart.size > 0 && (
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
                        ? `Abre el pedido para elegir bebida y acompañamiento para cada plato individual.`
                        : `Cada plato principal incluye su acompañamiento y bebida con descuento.`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsCartDrawerOpen(true)}
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
                onClick={() => setIsCartDrawerOpen(true)}
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
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (nameError && e.target.value.trim()) setNameError(false);
                    }}
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
                  onClick={handleConfirmOrder}
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
      )}

      {/* Slide-over "Mi Pedido Actual" Drawer (Bundle Padre-Hijo) */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Blur */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
            onClick={() => {
              setIsCartDrawerOpen(false);
              setOpenSwapPicker(null);
            }}
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
                    <p className="text-[11px] text-neutral-400">Personaliza tus combos, bebidas y platos sin rodeos</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {cart.size > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-[11px] font-mono text-red-400/80 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20 transition-all"
                    >
                      Vaciar
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsCartDrawerOpen(false);
                      setOpenSwapPicker(null);
                    }}
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
                    <p className="text-xs text-neutral-600">Explora el menú y toca "+ Agregar" en lo que te provoque.</p>
                  </div>
                ) : (
                  Array.from(cart.values()).map(({ product: prod, quantity }) => {
                    const isMain = prod.category_id === 'burgers' || prod.category_id === 'dogs';
                    const combo = isMain ? combosByProduct.get(prod.id) : null;
                    const mods = itemModifiers.get(prod.id) || { without: [], extras: [] };
                    const isCustomizing = customizingProductId === prod.id;
                    const availableExclusions =
                      EXCLUSIONS_BY_CATEGORY[prod.category_id] || EXCLUSIONS_BY_CATEGORY['default'];

                    // Current chosen side and drink for this main dish combo
                    const currentSide = combo
                      ? AVAILABLE_SIDES.find((s) => s.id === combo.sideId) || AVAILABLE_SIDES[0]
                      : AVAILABLE_SIDES[0];
                    const currentDrink = combo
                      ? AVAILABLE_DRINKS.find((d) => d.id === combo.drinkId) || AVAILABLE_DRINKS[0]
                      : AVAILABLE_DRINKS[0];

                    return (
                      <div
                        key={prod.id}
                        className="bg-[#141419] rounded-2xl p-4 border border-white/[0.06] hover:border-white/[0.12] transition-all space-y-3"
                      >
                        {/* Parent Item Row */}
                        <div className="flex items-start gap-3">
                          {/* Delayed Progressive Hover Zoom Thumbnail (700ms - 1s Delay) */}
                          <div className="relative group/zoom flex-shrink-0 cursor-pointer">
                            <div className="w-16 h-12 rounded-xl overflow-hidden bg-[#1c1c24] border border-white/[0.08]">
                              {prod.image_url?.startsWith('/') ? (
                                <img
                                  src={prod.image_url}
                                  alt={prod.name}
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
                                <img
                                  src={prod.image_url}
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <p className="text-xs font-bold text-white px-1 leading-snug">{prod.name}</p>
                              <p className="text-[10px] text-neutral-400 px-1 mt-0.5 line-clamp-2 leading-tight">
                                {prod.description}
                              </p>
                              <span className="text-[9px] font-mono text-amber-400 px-1 mt-1 block">
                                ${prod.base_price.toFixed(2)} CAD c/u
                              </span>
                            </div>
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="text-xs font-bold text-white truncate leading-tight">{prod.name}</h4>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] font-mono text-neutral-400">
                                ${prod.base_price.toFixed(2)} CAD
                              </span>
                              {quantity > 1 && (
                                <span className="text-[10px] font-mono text-amber-400/90 font-medium">
                                  × {quantity} uds
                                </span>
                              )}
                            </div>

                            {/* Active Customization Badges */}
                            {(mods.without.length > 0 || mods.extras.length > 0) && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {mods.without.map((w) => (
                                  <span
                                    key={w}
                                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20 line-through"
                                  >
                                    {w}
                                  </span>
                                ))}
                                {mods.extras.map((extraId) => {
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
                                onClick={() => removeFromCart(prod.id)}
                                className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-white flex items-center justify-center text-xs font-bold transition-all"
                              >
                                -
                              </button>
                              <span className="w-6 text-center font-mono font-bold text-amber-400 text-xs">
                                {quantity}
                              </span>
                              <button
                                onClick={() => addToCart(prod)}
                                className="w-7 h-7 rounded-lg bg-amber-500 text-black flex items-center justify-center text-xs font-bold hover:bg-amber-400 transition-all"
                              >
                                +
                              </button>
                            </div>
                            <button
                              onClick={() => deleteFromCart(prod.id)}
                              className="w-7 h-7 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center text-xs transition-all border border-red-500/20"
                              title="Eliminar este plato y su combo"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Combo Criollo Bundle Section (Only for Mains) */}
                        {isMain && (
                          <div className="pt-2 border-t border-white/[0.04]">
                            {!combo ? (
                              <button
                                type="button"
                                onClick={() => toggleComboForMain(prod.id)}
                                className="w-full py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-between transition-all group"
                              >
                                <span className="flex items-center gap-2">
                                  <span>🍟🥤</span>
                                  <span>¿Volver Combo Criollo para este plato?</span>
                                </span>
                                <span className="font-mono text-[11px] bg-amber-500/20 px-2 py-0.5 rounded-full text-amber-200 group-hover:bg-amber-500 group-hover:text-black transition-colors">
                                  +$7.50 CAD
                                </span>
                              </button>
                            ) : (
                              <div className="bg-[#0f0f14] border border-emerald-500/30 rounded-xl p-3 space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                      <span className="text-emerald-400">✓</span> Combo Criollo Asignado
                                    </span>
                                    <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-bold">
                                      -$1.50 CAD Ahorro
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleComboForMain(prod.id)}
                                    className="text-[10px] font-mono text-red-400/80 hover:text-red-300 underline"
                                  >
                                    Quitar combo
                                  </button>
                                </div>

                                {/* Side Choice with Swap Dropdown */}
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.04]">
                                  <span className="text-neutral-400 font-mono text-[11px] flex items-center gap-1.5">
                                    <span>🍟</span> Acompañamiento:
                                  </span>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenSwapPicker(
                                          openSwapPicker?.productId === prod.id && openSwapPicker.type === 'side'
                                            ? null
                                            : { productId: prod.id, type: 'side' }
                                        )
                                      }
                                      className="text-[11px] font-medium text-white hover:text-amber-300 flex items-center gap-1.5 bg-[#181820] hover:bg-[#20202a] px-2.5 py-1.5 rounded-lg border border-white/[0.08] transition-all"
                                    >
                                      <span>{currentSide.name}</span>
                                      {currentSide.delta > 0 && (
                                        <span className="text-amber-400 font-mono text-[10px]">
                                          (+${currentSide.delta.toFixed(2)})
                                        </span>
                                      )}
                                      <span className="text-[9px] text-neutral-400">▾</span>
                                    </button>

                                    {/* Swap Picker for Sides */}
                                    {openSwapPicker?.productId === prod.id && openSwapPicker.type === 'side' && (
                                      <div className="absolute right-0 top-full mt-1.5 z-40 w-60 bg-[#16161e] border border-amber-500/40 rounded-xl p-1.5 shadow-2xl space-y-1">
                                        <div className="px-2 py-1 text-[10px] font-mono text-neutral-400 uppercase tracking-wider border-b border-white/[0.06]">
                                          Elige acompañamiento:
                                        </div>
                                        {AVAILABLE_SIDES.map((s) => (
                                          <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => {
                                              updateComboSide(prod.id, s.id);
                                              setOpenSwapPicker(null);
                                            }}
                                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                              currentSide.id === s.id
                                                ? 'bg-amber-500 text-black font-bold'
                                                : 'text-neutral-300 hover:bg-white/[0.08]'
                                            }`}
                                          >
                                            <span>{s.icon} {s.name}</span>
                                            <span className="font-mono text-[10px]">
                                              {s.delta > 0 ? `+$${s.delta.toFixed(2)} CAD` : 'Incluido'}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Drink Choice with Swap Dropdown */}
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.04]">
                                  <span className="text-neutral-400 font-mono text-[11px] flex items-center gap-1.5">
                                    <span>🥤</span> Bebida:
                                  </span>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOpenSwapPicker(
                                          openSwapPicker?.productId === prod.id && openSwapPicker.type === 'drink'
                                            ? null
                                            : { productId: prod.id, type: 'drink' }
                                        )
                                      }
                                      className="text-[11px] font-medium text-white hover:text-amber-300 flex items-center gap-1.5 bg-[#181820] hover:bg-[#20202a] px-2.5 py-1.5 rounded-lg border border-white/[0.08] transition-all"
                                    >
                                      <span>{currentDrink.name}</span>
                                      {currentDrink.delta > 0 && (
                                        <span className="text-amber-400 font-mono text-[10px]">
                                          (+${currentDrink.delta.toFixed(2)})
                                        </span>
                                      )}
                                      <span className="text-[9px] text-neutral-400">▾</span>
                                    </button>

                                    {/* Swap Picker for Drinks */}
                                    {openSwapPicker?.productId === prod.id && openSwapPicker.type === 'drink' && (
                                      <div className="absolute right-0 top-full mt-1.5 z-40 w-64 bg-[#16161e] border border-amber-500/40 rounded-xl p-1.5 shadow-2xl space-y-1">
                                        <div className="px-2 py-1 text-[10px] font-mono text-neutral-400 uppercase tracking-wider border-b border-white/[0.06]">
                                          Elige bebida:
                                        </div>
                                        {AVAILABLE_DRINKS.map((d) => (
                                          <button
                                            key={d.id}
                                            type="button"
                                            onClick={() => {
                                              updateComboDrink(prod.id, d.id);
                                              setOpenSwapPicker(null);
                                            }}
                                            className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                              currentDrink.id === d.id
                                                ? 'bg-amber-500 text-black font-bold'
                                                : 'text-neutral-300 hover:bg-white/[0.08]'
                                            }`}
                                          >
                                            <span>{d.icon} {d.name}</span>
                                            <span className="font-mono text-[10px]">
                                              {d.delta > 0 ? `+$${d.delta.toFixed(2)} CAD` : 'Incluido'}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Customization Toggle & Tactile Chips */}
                        <div className="border-t border-white/[0.04] pt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setCustomizingProductId(isCustomizing ? null : prod.id)
                            }
                            className="text-[11px] font-mono font-medium text-neutral-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                          >
                            <span>{isCustomizing ? '▲ Cerrar personalización de receta' : '⚙️ Personalizar ingredientes (Quitar / Agregar)'}</span>
                          </button>

                          {isCustomizing && (
                            <div className="mt-2.5 p-3 rounded-xl bg-[#0a0a0d] border border-amber-500/20 space-y-2.5 animate-in fade-in duration-150">
                              {/* Exclusions */}
                              <div>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1.5">
                                  🚫 Quitar Ingredientes (Sin costo):
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {availableExclusions.map((ex) => {
                                    const isExcluded = mods.without.includes(ex);
                                    return (
                                      <button
                                        key={ex}
                                        type="button"
                                        onClick={() => toggleExclusion(prod.id, ex)}
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

                              {/* Extras */}
                              <div>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1.5">
                                  ✨ Extras Opcionales:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {AVAILABLE_EXTRAS.map((extra) => {
                                    const isAdded = mods.extras.includes(extra.id);
                                    return (
                                      <button
                                        key={extra.id}
                                        type="button"
                                        onClick={() => toggleExtra(prod.id, extra.id)}
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
                  })
                )}
              </div>

              {/* Drawer Footer with Checkout */}
              {cart.size > 0 && (
                <div className="p-6 border-t border-white/[0.08] bg-[#131318] space-y-4">
                  {/* Totals Breakdown */}
                  <div className="space-y-1.5 text-xs text-neutral-300">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Subtotal platos y combos ({totalItems} items):</span>
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

                  {/* Customer Name & Confirm Button */}
                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Tu nombre (obligatorio para turno)"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          if (nameError && e.target.value.trim()) setNameError(false);
                        }}
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
                      onClick={handleConfirmOrder}
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
      )}

      {/* Full-Screen Confirmation Screen (Large Sequential Ticket Number) */}
      {confirmedOrder && (
        <div className="fixed inset-0 z-50 bg-[#09090b]/98 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
          <div className="max-w-md w-full bg-[#121216] border border-amber-500/30 rounded-3xl p-8 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ✓ Pedido Enviado a Cocina
              </span>
              <h2 className="text-xl font-bold text-white">¡Gracias por tu pedido!</h2>
              {confirmedOrder.customer_name && (
                <p className="text-sm text-amber-300 font-medium">Comensal: {confirmedOrder.customer_name}</p>
              )}
            </div>

            {/* Huge Ticket Number */}
            <div className="bg-[#181820] rounded-2xl py-8 px-4 border border-white/[0.08] space-y-1">
              <span className="text-xs font-mono uppercase tracking-widest text-neutral-400 font-semibold">
                Número de Turno
              </span>
              <div className="text-6xl md:text-7xl font-mono font-black text-amber-400 tracking-tight">
                #{confirmedOrder.order_number}
              </div>
              <span className="text-xs text-neutral-400 block pt-1">
                Total: ${confirmedOrder.total_amount.toFixed(2)} CAD
              </span>
            </div>

            {/* Order Items Preview */}
            <div className="text-left text-xs text-neutral-300 space-y-1 max-h-36 overflow-y-auto pr-1">
              <span className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">Resumen del Ticket:</span>
              {confirmedOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span>{item.quantity}x {item.product_name}</span>
                  <span className="font-mono text-neutral-400">${item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Toma asiento. Te llamaremos por tu número de turno en cuanto esté listo tu pedido en cocina.
            </p>

            {/* Auto-reset Countdown */}
            <div className="pt-2">
              <button
                onClick={() => {
                  setConfirmedOrder(null);
                  setCart(new Map());
                  setItemModifiers(new Map());
                  setCombosByProduct(new Map());
                  setCustomerName('');
                  setNameError(false);
                  setIsCartDrawerOpen(false);
                }}
                className="w-full py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-mono text-white transition-all flex items-center justify-center gap-2"
              >
                <span>Siguiente Cliente</span>
                <span className="text-amber-400">({countdown}s)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
