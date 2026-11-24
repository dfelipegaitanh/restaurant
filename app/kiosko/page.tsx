'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { CategoryWithProducts, OrderSummary } from '@/types/domain';
import { buildOrderItemsPayload } from '@/lib/kiosk/cart';
import { useKioskCart } from './_hooks/useKioskCart';
import { ProductCard } from './_components/ProductCard';
import { FloatingOrderBar } from './_components/FloatingOrderBar';
import { CartDrawer } from './_components/CartDrawer';
import { OrderConfirmedModal } from './_components/OrderConfirmedModal';

/** Main self-ordering kiosk page coordinating catalog sync, category browsing, and checkout. */
export default function KioskPage() {
  const [categories, setCategories] = useState<CategoryWithProducts[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('burgers');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderSummary | null>(null);
  const [countdown, setCountdown] = useState<number>(6);
  const [customerName, setCustomerName] = useState<string>('');
  const [nameError, setNameError] = useState(false);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());

  const {
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
  } = useKioskCart();

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

    const pollInterval = setInterval(() => loadMenu(false), 3000);
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

  const resetOrderSession = useCallback(() => {
    setConfirmedOrder(null);
    clearAll();
    setCustomerName('');
    setNameError(false);
    setIsCartDrawerOpen(false);
  }, [clearAll]);

  useEffect(() => {
    if (!confirmedOrder) return;
    setCountdown(6);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          resetOrderSession();
          return 6;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [confirmedOrder, resetOrderSession]);

  const toggleExpandDescription = useCallback((productId: string) => {
    setExpandedDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  const handleCustomerNameChange = useCallback(
    (name: string) => {
      setCustomerName(name);
      if (nameError && name.trim()) setNameError(false);
    },
    [nameError]
  );

  const handleClearCart = useCallback(() => {
    clearAll();
    setIsCartDrawerOpen(false);
  }, [clearAll]);

  const handleCloseDrawer = useCallback(() => {
    setIsCartDrawerOpen(false);
    setOpenSwapPicker(null);
  }, [setOpenSwapPicker]);

  const handleCustomizeFromCard = useCallback(
    (productId: string) => {
      setCustomizingProductId(productId);
      setIsCartDrawerOpen(true);
    },
    [setCustomizingProductId]
  );

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
    const itemsPayload = buildOrderItemsPayload(cart, combosByProduct);

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
    } catch (err) {
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

        <main className="flex-1 pt-4">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-neutral-500 font-mono text-sm">
              Cargando menú criollo...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeCategory?.products.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  quantity={cart.get(prod.id)?.quantity || 0}
                  combosCount={(combosByProduct.get(prod.id) || []).length}
                  isDescriptionExpanded={expandedDescriptions.has(prod.id)}
                  onToggleDescription={toggleExpandDescription}
                  onAdd={addToCart}
                  onRemove={removeFromCart}
                  onCustomize={handleCustomizeFromCard}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <FloatingOrderBar
        hasItems={cart.size > 0}
        totals={totals}
        comboStats={comboStats}
        customerName={customerName}
        nameError={nameError}
        submitting={submitting}
        onOpenDrawer={() => setIsCartDrawerOpen(true)}
        onCustomerNameChange={handleCustomerNameChange}
        onConfirmOrder={handleConfirmOrder}
      />

      <CartDrawer
        isOpen={isCartDrawerOpen}
        cart={cart}
        combosByProduct={combosByProduct}
        itemModifiers={itemModifiers}
        customizingProductId={customizingProductId}
        openSwapPicker={openSwapPicker}
        totals={totals}
        activeCombosCount={comboStats.activeCombosCount}
        customerName={customerName}
        nameError={nameError}
        submitting={submitting}
        onClose={handleCloseDrawer}
        onClearCart={handleClearCart}
        onCustomerNameChange={handleCustomerNameChange}
        onConfirmOrder={handleConfirmOrder}
        onAdd={addToCart}
        onRemove={removeFromCart}
        onDelete={deleteFromCart}
        onAddCombo={addComboToProduct}
        onRemoveCombo={removeComboFromProduct}
        onReplicateCombo={replicateComboToAll}
        onSetSwapPicker={setOpenSwapPicker}
        onUpdateComboField={updateComboSlotField}
        onToggleCustomizing={setCustomizingProductId}
        onToggleExclusion={toggleExclusion}
        onToggleExtra={toggleExtra}
      />

      <OrderConfirmedModal
        order={confirmedOrder}
        countdown={countdown}
        onReset={resetOrderSession}
      />
    </div>
  );
}
