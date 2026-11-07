'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { OrderSummary, OrderStatus } from '@/types/domain';

// Synthesizes a clean audio chime without external mp3 files
function playKitchenChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880.0, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880.0, now);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.25); // D6

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.05);
    osc1.stop(now + 0.8);
    osc2.stop(now + 0.8);
  } catch (e) {
    console.error('Audio chime error:', e);
  }
}

// Format elapsed seconds into mm:ss
function formatElapsed(createdAt: string): { text: string; alertLevel: 'green' | 'yellow' | 'red' } {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  const text = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  if (mins < 5) return { text, alertLevel: 'green' };
  if (mins < 10) return { text, alertLevel: 'yellow' };
  return { text, alertLevel: 'red' };
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [, setTicker] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const soundEnabledRef = useRef<boolean>(true);

  soundEnabledRef.current = soundEnabled;

  // 1. Initial hydration
  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error('Error fetching kitchen orders:', err);
    }
  };

  useEffect(() => {
    fetchOrders();

    // 1-second interval to update elapsed timers on tickets
    const timerInterval = setInterval(() => {
      setTicker((prev) => prev + 1);
    }, 1000);

    // 2. Real-time SSE connection
    let es: EventSource | null = null;
    const connectSSE = () => {
      es = new EventSource('/api/realtime');

      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es?.close();
        setTimeout(connectSSE, 3000);
      };

      es.addEventListener('ORDER_CREATED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const newOrder: OrderSummary = payload.order;
          if (newOrder) {
            setOrders((prev) => {
              if (prev.some((o) => o.id === newOrder.id)) return prev;
              return [...prev, newOrder];
            });
            if (soundEnabledRef.current) {
              playKitchenChime();
            }
          }
        } catch (err) {
          console.error('Error parsing ORDER_CREATED:', err);
        }
      });

      es.addEventListener('ORDER_STATUS_CHANGED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const { order_id, new_status } = payload;
          setOrders((prev) => {
            if (new_status === 'SERVED' || new_status === 'CANCELLED') {
              return prev.filter((o) => o.id !== order_id);
            }
            return prev.map((o) => (o.id === order_id ? { ...o, status: new_status } : o));
          });
        } catch (err) {
          console.error('Error parsing ORDER_STATUS_CHANGED:', err);
        }
      });
    };

    connectSSE();

    return () => {
      clearInterval(timerInterval);
      if (es) es.close();
    };
  }, []);

  // Status transitions
  const advanceStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => {
          if (nextStatus === 'SERVED' || nextStatus === 'CANCELLED') {
            return prev.filter((o) => o.id !== orderId);
          }
          return prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o));
        });
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
  const inPrepOrders = orders.filter((o) => o.status === 'IN_PREP');
  const readyOrders = orders.filter((o) => o.status === 'READY');

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 flex flex-col font-sans select-none">
      {/* Top Bar */}
      <header className="border-b border-white/[0.08] bg-[#0c0c0e]/95 backdrop-blur-xl px-6 py-4 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-serif font-bold text-lg hover:bg-amber-500/20 transition-all"
          >
            🍳
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">KDS Cocina & Despacho</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                {orders.length} Activas
              </span>
            </div>
            <p className="text-xs text-neutral-400">Recepción de comandas en tiempo real vía Server-Sent Events</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all flex items-center gap-1.5 ${
              soundEnabled
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-white/[0.04] text-neutral-500 border-white/[0.08]'
            }`}
          >
            <span>{soundEnabled ? '🔔 Chime Activo' : '🔕 Chime Mudo'}</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs font-mono text-neutral-300">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-red-500'
              }`}
            />
            <span>{connected ? 'SSE En Vivo' : 'Reconectando...'}</span>
          </div>

          <Link
            href="/kiosko"
            className="text-xs font-mono text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] transition-all"
          >
            Abrir Kiosko →
          </Link>
        </div>
      </header>

      {/* 3-Column Kanban Board */}
      <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
        {/* Column 1: PENDING */}
        <section className="bg-[#101014] border border-amber-500/20 rounded-2xl p-4 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-300 font-mono">
                Nuevas Comandas
              </h2>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
              {pendingOrders.length}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {pendingOrders.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-neutral-600 text-xs font-mono">
                Sin pedidos en cola
              </div>
            ) : (
              pendingOrders.map((order) => (
                <OrderTicketCard
                  key={order.id}
                  order={order}
                  actionLabel="Comenzar Preparación"
                  actionColor="bg-amber-500 hover:bg-amber-400 text-black"
                  onAction={() => advanceStatus(order.id, 'IN_PREP')}
                />
              ))
            )}
          </div>
        </section>

        {/* Column 2: IN_PREP */}
        <section className="bg-[#101014] border border-blue-500/20 rounded-2xl p-4 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse"></span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-blue-300 font-mono">
                En Preparación
              </h2>
            </div>
            <span className="text-xs font-mono font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
              {inPrepOrders.length}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {inPrepOrders.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-neutral-600 text-xs font-mono">
                Nada en fogones
              </div>
            ) : (
              inPrepOrders.map((order) => (
                <OrderTicketCard
                  key={order.id}
                  order={order}
                  actionLabel="Marcar Listo"
                  actionColor="bg-blue-500 hover:bg-blue-400 text-white"
                  onAction={() => advanceStatus(order.id, 'READY')}
                />
              ))
            )}
          </div>
        </section>

        {/* Column 3: READY */}
        <section className="bg-[#101014] border border-emerald-500/20 rounded-2xl p-4 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-300 font-mono">
                Listas para Entrega
              </h2>
            </div>
            <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
              {readyOrders.length}
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto">
            {readyOrders.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-neutral-600 text-xs font-mono">
                Ninguna orden en mostrador
              </div>
            ) : (
              readyOrders.map((order) => (
                <OrderTicketCard
                  key={order.id}
                  order={order}
                  actionLabel="Entregar al Cliente"
                  actionColor="bg-emerald-500 hover:bg-emerald-400 text-black"
                  onAction={() => advanceStatus(order.id, 'SERVED')}
                />
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

// Single Ticket Card in Kanban
function OrderTicketCard({
  order,
  actionLabel,
  actionColor,
  onAction,
}: {
  order: OrderSummary;
  actionLabel: string;
  actionColor: string;
  onAction: () => void;
}) {
  const { text: elapsedText, alertLevel } = formatElapsed(order.created_at);

  const timerBadgeStyle =
    alertLevel === 'red'
      ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
      : alertLevel === 'yellow'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';

  return (
    <div className="bg-[#16161c] border border-white/[0.08] rounded-xl p-4 space-y-3 shadow-lg hover:border-white/[0.15] transition-all">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-2xl font-black font-mono text-white tracking-tight">
            #{order.order_number}
          </span>
          {order.customer_name && (
            <span className="text-xs text-amber-300 block font-medium mt-0.5">
              {order.customer_name}
            </span>
          )}
        </div>
        <span className={`text-xs font-mono px-2.5 py-1 rounded-md border font-bold ${timerBadgeStyle}`}>
          ⏱ {elapsedText}
        </span>
      </div>

      {/* Items List */}
      <div className="space-y-1.5 py-2 border-y border-white/[0.06] text-xs">
        {order.items.map((item, idx) => (
          <div key={idx} className="flex items-start justify-between gap-2">
            <span className="text-white font-medium">
              <strong className="text-amber-400 font-mono mr-1.5">{item.quantity}x</strong>
              {item.product_name}
            </span>
          </div>
        ))}
      </div>

      {/* Action Button */}
      <button
        onClick={onAction}
        className={`w-full py-2.5 rounded-lg font-bold text-xs tracking-wide shadow-md transition-all active:scale-[0.98] ${actionColor}`}
      >
        {actionLabel} →
      </button>
    </div>
  );
}
