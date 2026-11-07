'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Product, CategoryWithProducts, OrderSummary } from '@/types/domain';
import ModifierModal, { CartLineItem } from './ModifierModal';
import CartDrawer from './CartDrawer';
import OrderTracker from './OrderTracker';
import { formatCurrency } from '@/lib/utils/formatters';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MesaPage({ params }: PageProps) {
  const unwrappedParams = use(params);
  const rawId = unwrappedParams.id;
  const tableId = rawId.startsWith('table-') ? rawId : `table-${rawId}`;

  const [categories, setCategories] = useState<CategoryWithProducts[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [tableExists, setTableExists] = useState<boolean | null>(null);
  const [tableNumber, setTableNumber] = useState<number | null>(null);

  // Modal & Cart State
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);

  // Order Tracker State
  const [trackedOrder, setTrackedOrder] = useState<OrderSummary | null>(null);
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);

  // 1. Validate Table & Fetch Menu
  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoadingMenu(true);

        const tablesRes = await fetch('/api/tables');
        const tablesData = await tablesRes.json();

        if (tablesData.success && Array.isArray(tablesData.tables)) {
          const found = tablesData.tables.find(
            (t: any) => t.id === tableId || String(t.table_number) === rawId
          );
          if (found) {
            setTableExists(true);
            setTableNumber(found.table_number);
          } else {
            setTableExists(false);
          }
        }

        const menuRes = await fetch('/api/menu');
        const menuData = await menuRes.json();
        if (menuData.success) {
          setCategories(menuData.categories || []);
          setProducts(menuData.products || []);
        }
      } catch (err) {
        console.error('[MesaPage] Error loading menu or table:', err);
      } finally {
        setIsLoadingMenu(false);
      }
    }

    loadInitialData();
  }, [tableId, rawId]);

  // 2. Hydrate Persistent Cart from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storageKey = `restaurant_cart_${tableId}`;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCartItems(parsed);
        }
      }
    } catch (e) {
      console.warn('[MesaPage] Failed to parse stored cart:', e);
    }
  }, [tableId]);

  // 3. Save Cart to localStorage on changes
  const updateCartAndPersist = (newItems: CartLineItem[]) => {
    setCartItems(newItems);
    if (typeof window !== 'undefined') {
      const storageKey = `restaurant_cart_${tableId}`;
      try {
        if (newItems.length === 0) {
          localStorage.removeItem(storageKey);
        } else {
          localStorage.setItem(storageKey, JSON.stringify(newItems));
        }
      } catch (e) {
        console.warn('[MesaPage] Failed to save cart to localStorage:', e);
      }
    }
  };

  // Add customized item to cart
  const handleAddToCart = (newItem: CartLineItem) => {
    const existingIndex = cartItems.findIndex((item) => item.line_id === newItem.line_id);
    if (existingIndex >= 0) {
      const updated = [...cartItems];
      const existing = updated[existingIndex];
      const newQty = existing.quantity + newItem.quantity;
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        subtotal: newQty * existing.unit_price,
      };
      updateCartAndPersist(updated);
    } else {
      updateCartAndPersist([...cartItems, newItem]);
    }
    setIsCartOpen(true);
  };

  // Update item quantity in cart
  const handleUpdateQuantity = (lineId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(lineId);
      return;
    }
    const updated = cartItems.map((item) => {
      if (item.line_id === lineId) {
        return {
          ...item,
          quantity: newQty,
          subtotal: newQty * item.unit_price,
        };
      }
      return item;
    });
    updateCartAndPersist(updated);
  };

  // Remove item from cart
  const handleRemoveItem = (lineId: string) => {
    const updated = cartItems.filter((item) => item.line_id !== lineId);
    updateCartAndPersist(updated);
  };

  // Trigger customization modal for dish
  const handleOpenCustomize = (product: Product) => {
    setCustomizingProduct(product);
    setIsModalOpen(true);
  };

  // Quick add for dishes without modifier groups
  const handleQuickAdd = (product: Product) => {
    if (product.modifier_groups && product.modifier_groups.length > 0) {
      handleOpenCustomize(product);
    } else {
      handleAddToCart({
        line_id: product.id,
        product_id: product.id,
        product_name: product.name,
        base_price: product.base_price,
        unit_price: product.base_price,
        quantity: 1,
        subtotal: product.base_price,
        modifiers: [],
      });
    }
  };

  const handleOrderSuccess = (order: OrderSummary) => {
    updateCartAndPersist([]);
    setTrackedOrder(order);
    setIsTrackerOpen(true);
  };

  const filteredProducts =
    selectedCategoryId === 'all'
      ? products
      : products.filter((p) => p.category_id === selectedCategoryId);

  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartAmount = cartItems.reduce((sum, item) => sum + item.subtotal, 0);

  if (tableExists === false) {
    return (
      <main className="min-h-screen bg-[#09090b] text-neutral-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md bg-[#121215] border border-white/[0.08] p-8 rounded-2xl shadow-2xl space-y-4">
          <span className="text-3xl text-neutral-500 font-mono">404</span>
          <h1 className="text-xl font-serif text-white">Mesa no registrada</h1>
          <p className="text-xs text-neutral-400">
            La mesa <code className="text-amber-400 font-mono">{rawId}</code> no existe en el sistema.
          </p>
          <div className="pt-4">
            <Link
              href="/"
              className="inline-flex min-h-[48px] px-6 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-neutral-200 text-xs font-mono transition items-center justify-center"
            >
              Volver al Inicio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-200 flex flex-col selection:bg-amber-500/20 selection:text-amber-300 font-sans">
      {/* 1. Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0c0c0e]/90 backdrop-blur-xl border-b border-white/[0.06] px-6 md:px-10 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-neutral-400 hover:text-white transition text-xs font-mono flex items-center gap-1.5"
            title="Volver al inicio"
          >
            <span>&larr;</span>
            <span className="hidden sm:inline">Inicio</span>
          </Link>

          <div className="h-4 w-[1px] bg-white/[0.08] hidden sm:block" />

          <div className="flex items-center gap-3">
            <span className="font-serif text-base tracking-tight text-white font-medium">Bistro Menu</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Mesa {tableNumber ?? rawId}
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {trackedOrder && (
            <button
              onClick={() => setIsTrackerOpen(true)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/60 transition flex items-center gap-2 text-xs font-mono"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Comanda #{trackedOrder.order_number}</span>
            </button>
          )}

          {/* Cart Pill */}
          <button
            onClick={() => setIsCartOpen(true)}
            aria-label="Abrir Carrito de compras"
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white flex items-center gap-3 transition active:scale-95"
          >
            <span className="text-xs font-mono text-neutral-300">Orden</span>
            {totalCartCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-neutral-950 text-xs font-mono font-bold">
                {totalCartCount}
              </span>
            ) : (
              <span className="text-xs text-neutral-500 font-mono">0</span>
            )}
            {totalCartAmount > 0 && (
              <span className="text-xs text-amber-300 font-mono font-medium hidden md:inline border-l border-white/[0.08] pl-2">
                {formatCurrency(totalCartAmount)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 2. Category Nav Pills */}
      <nav aria-label="Categorías del menú" className="sticky top-[57px] z-20 bg-[#09090b]/95 backdrop-blur-md border-b border-white/[0.04] px-6 md:px-10 py-3 overflow-x-auto scrollbar-none flex items-center gap-2">
        <button
          onClick={() => setSelectedCategoryId('all')}
          className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-medium tracking-wide whitespace-nowrap transition active:scale-95 ${
            selectedCategoryId === 'all'
              ? 'bg-amber-400 text-neutral-950 shadow-sm shadow-amber-500/20'
              : 'bg-white/[0.02] border border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.05]'
          }`}
        >
          Toda la Carta
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`min-h-[40px] px-4 py-1.5 rounded-full text-xs font-medium tracking-wide whitespace-nowrap transition active:scale-95 ${
              selectedCategoryId === cat.id
                ? 'bg-amber-400 text-neutral-950 shadow-sm shadow-amber-500/20'
                : 'bg-white/[0.02] border border-white/[0.06] text-neutral-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </nav>

      {/* 3. Product Catalog Grid */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {isLoadingMenu ? (
          <div className="py-32 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-6 h-6 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
            <p className="text-xs text-neutral-500 font-mono tracking-wider">Cargando la carta...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-32 text-center text-neutral-500 space-y-2">
            <p className="text-sm font-serif text-neutral-400">No hay platos disponibles en esta categoría</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProducts.map((product) => {
              const hasModifiers = product.modifier_groups && product.modifier_groups.length > 0;

              return (
                <article
                  key={product.id}
                  className="bg-[#121216] border border-white/[0.06] rounded-2xl p-6 flex flex-col justify-between hover:border-amber-500/30 transition-all duration-200 group relative overflow-hidden shadow-lg"
                >
                  <div className="space-y-4">
                    {/* Header: Tag + Base Price */}
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                        {product.category || 'Especialidad'}
                      </span>
                      <span className="text-base font-serif font-medium text-amber-300">
                        {formatCurrency(product.base_price)}
                      </span>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-1.5">
                      <h2 className="text-lg font-serif font-normal text-white group-hover:text-amber-200 transition-colors">
                        {product.name}
                      </h2>
                      {product.description && (
                        <p className="text-xs text-neutral-400 leading-relaxed font-light line-clamp-3">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* Modifiers Pill Preview */}
                    {hasModifiers && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {product.modifier_groups.map((g) => (
                          <span
                            key={g.id}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.03] text-neutral-400 border border-white/[0.06]"
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="pt-6 mt-4 border-t border-white/[0.05]">
                    <button
                      type="button"
                      onClick={() =>
                        hasModifiers ? handleOpenCustomize(product) : handleQuickAdd(product)
                      }
                      className={`w-full min-h-[46px] rounded-xl text-xs font-medium tracking-wide flex items-center justify-center gap-2 transition active:scale-95 ${
                        hasModifiers
                          ? 'bg-white/[0.03] hover:bg-white/[0.07] text-neutral-200 border border-white/[0.08] hover:border-amber-500/40'
                          : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 font-semibold shadow-sm'
                      }`}
                    >
                      {hasModifiers ? (
                        <>
                          <span>Personalizar Plato</span>
                          <span className="text-amber-400">&rarr;</span>
                        </>
                      ) : (
                        <span>+ Agregar</span>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar for Tablet */}
      {cartItems.length > 0 && !isCartOpen && (
        <aside aria-label="Resumen flotante del pedido" className="fixed bottom-6 left-6 right-6 max-w-md mx-auto z-20">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full min-h-[52px] bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded-2xl px-5 py-3.5 font-medium flex items-center justify-between shadow-2xl shadow-amber-500/30 transition active:scale-95"
          >
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded-full bg-neutral-950 text-amber-300 text-xs font-mono font-bold">
                {totalCartCount}
              </span>
              <span className="text-xs font-mono uppercase tracking-wider">Ver Mi Comanda</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-serif font-medium">
              <span>{formatCurrency(totalCartAmount)}</span>
              <span>&rarr;</span>
            </div>
          </button>
        </aside>
      )}

      {/* 4. Native <dialog> Customizer Modal */}
      <ModifierModal
        product={customizingProduct}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setCustomizingProduct(null);
        }}
        onAddToCart={handleAddToCart}
      />

      {/* 5. Persistent Cart Drawer */}
      <CartDrawer
        tableId={tableId}
        items={cartItems}
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onOrderSuccess={handleOrderSuccess}
      />

      {/* 6. Order Stepper Live Tracker */}
      {isTrackerOpen && trackedOrder && (
        <OrderTracker
          tableId={tableId}
          latestOrder={trackedOrder}
          onClose={() => setIsTrackerOpen(false)}
        />
      )}
    </div>
  );
}
