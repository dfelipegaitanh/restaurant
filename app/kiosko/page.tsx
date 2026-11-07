'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { CategoryWithProducts, Product, OrderSummary } from '@/types/domain';

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

  // Fetch catalog from /api/menu
  useEffect(() => {
    fetch('/api/menu')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.categories.length > 0) {
          setCategories(data.categories);
          setActiveCategoryId(data.categories[0].id);
        }
      })
      .catch((err) => console.error('Error fetching menu:', err))
      .finally(() => setLoading(false));
  }, []);

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
          setCustomerName('');
          setNameError(false);
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
      }
      return next;
    });
  };

  // Cart computations
  const { totalItems, totalAmount } = useMemo(() => {
    let items = 0;
    let amount = 0;
    for (const entry of cart.values()) {
      items += entry.quantity;
      amount += entry.quantity * entry.product.base_price;
    }
    return { totalItems: items, totalAmount: Number(amount.toFixed(2)) };
  }, [cart]);

  // Submit order
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
    const itemsPayload = Array.from(cart.values()).map((entry) => ({
      product_id: entry.product.id,
      quantity: entry.quantity,
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
      <div className="flex-1 flex flex-col max-w-6xl w-full mx-auto px-4 py-4 pb-32">
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
                      {/* Product Visual Header (Native 4:3 ratio matching Flow photography) */}
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
                        <h3 className="text-base font-bold text-white group-hover:text-amber-200 transition-colors leading-snug">
                          {prod.name}
                        </h3>
                        <p className="text-xs text-neutral-400 leading-relaxed font-light line-clamp-2">
                          {prod.description}
                        </p>
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
                          <span className="text-xs font-mono text-emerald-400 font-medium">
                            ${(quantity * prod.base_price).toFixed(2)} CAD
                          </span>
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
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c0c0e]/95 backdrop-blur-2xl border-t border-amber-500/20 p-4 shadow-2xl">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-black flex items-center justify-center font-mono font-black text-lg shadow-lg shadow-amber-500/30">
                {totalItems}
              </div>
              <div>
                <div className="text-xs text-neutral-400">Total a pagar:</div>
                <div className="text-2xl font-bold font-mono text-white flex items-baseline gap-1.5">
                  <span>${totalAmount.toFixed(2)}</span>
                  <span className="text-xs text-amber-400 font-sans font-semibold">CAD</span>
                </div>
              </div>
            </div>

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
                  setCustomerName('');
                  setNameError(false);
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
