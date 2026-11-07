'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { OrderSummary, OrderStatus } from '@/types/domain';
import KanbanColumn from './KanbanColumn';
import { playOrderChime, unlockAudioContext, isAudioUnlocked } from '@/lib/utils/audio';
import { wakeLockManager } from '@/lib/utils/wakeLock';

export default function CocinaPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Audio State
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);

  // Screen Wake Lock State
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [wakeLockSupported, setWakeLockSupported] = useState(true);

  // Connection State
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const fetchActiveOrders = useCallback(async () => {
    try {
      const tablesRes = await fetch('/api/tables');
      const tablesData = await tablesRes.json();

      if (!tablesData.success || !Array.isArray(tablesData.tables)) return;

      const activeTables = tablesData.tables.filter(
        (t: any) => t.status !== 'AVAILABLE' || (t.active_orders && t.active_orders.length > 0)
      );

      const allOrdersMap = new Map<string, OrderSummary>();

      await Promise.all(
        activeTables.map(async (table: any) => {
          try {
            const billRes = await fetch(`/api/tables/${table.id}/bill`);
            const billData = await billRes.json();
            if (billData.success && billData.bill && Array.isArray(billData.bill.orders)) {
              for (const ord of billData.bill.orders) {
                if (ord.status !== 'CANCELLED') {
                  allOrdersMap.set(ord.id, ord);
                }
              }
            }
          } catch (e) {
            console.warn(`[KDS] Error fetching bill for ${table.id}:`, e);
          }
        })
      );

      setOrders(Array.from(allOrdersMap.values()));
    } catch (err) {
      console.error('[KDS] Error fetching active orders:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveOrders();
  }, [fetchActiveOrders]);

  useEffect(() => {
    wakeLockManager.request().catch(() => {});

    const unsubscribe = wakeLockManager.subscribe((active, supported) => {
      setWakeLockActive(active);
      setWakeLockSupported(supported);
    });

    return () => {
      unsubscribe();
      wakeLockManager.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    setAudioUnlocked(isAudioUnlocked());
  }, []);

  const handleUnlockAudio = async () => {
    const unlocked = await unlockAudioContext();
    setAudioUnlocked(unlocked);
    if (unlocked) {
      playOrderChime();
    }
  };

  useEffect(() => {
    let es: EventSource | null = null;

    try {
      es = new EventSource('/api/realtime');

      es.onopen = () => {
        setIsConnected(true);
      };

      es.onerror = () => {
        setIsConnected(false);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'ORDER_CREATED') {
            const newOrder: OrderSummary = data.payload.order;
            if (newOrder) {
              setOrders((prev) => {
                if (prev.some((o) => o.id === newOrder.id)) return prev;
                return [newOrder, ...prev];
              });

              if (!isMutedRef.current) {
                playOrderChime();
              }
            }
          } else if (data.type === 'ORDER_STATUS_CHANGED') {
            const { order_id, new_status, updated_at } = data.payload;
            setOrders((prev) =>
              prev.map((ord) =>
                ord.id === order_id ? { ...ord, status: new_status, updated_at } : ord
              )
            );
          } else if (data.type === 'TABLE_STATUS_CHANGED') {
            if (data.payload.status === 'AVAILABLE') {
              setOrders((prev) => prev.filter((o) => o.table_id !== data.payload.table_id));
            }
          }
        } catch {
          // SSE heartbeat ping
        }
      };
    } catch (err) {
      console.warn('[KDS] SSE connection error:', err);
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, []);

  const handleAdvanceStatus = async (orderId: string, nextStatus: OrderStatus) => {
    const updateDOM = () => {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );
    };

    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as any).startViewTransition(async () => {
        updateDOM();
      });
    } else {
      updateDOM();
    }

    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        console.error('[KDS] Error advancing status, reverting...');
        fetchActiveOrders();
      }
    } catch (err) {
      console.error('[KDS] Network error advancing status:', err);
      fetchActiveOrders();
    }
  };

  const pendingOrders = orders.filter((o) => o.status === 'PENDING');
  const inPrepOrders = orders.filter((o) => o.status === 'IN_PREP');
  const readyOrders = orders.filter((o) => o.status === 'READY');
  const servedOrders = orders.filter((o) => o.status === 'SERVED');

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-200 flex flex-col font-sans select-none">
      {/* 1. Header Bar */}
      <header className="bg-[#0c0c0e]/90 backdrop-blur-xl border-b border-white/[0.06] px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-neutral-400 hover:text-white transition text-xs font-mono flex items-center gap-1.5"
            title="Volver al hub"
          >
            <span>&larr;</span>
            <span className="hidden sm:inline">Hub</span>
          </Link>

          <div className="h-4 w-[1px] bg-white/[0.08] hidden sm:block" />

          <div className="flex items-center gap-3">
            <span className="font-serif text-base tracking-tight text-white font-medium">Bistro KDS</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-white/[0.04] text-neutral-300 border border-white/[0.08]">
              {orders.length} en cola
            </span>
          </div>
        </div>

        {/* Right Status Controls */}
        <div className="flex items-center gap-2.5">
          {/* Wake Lock Status */}
          <div
            className={`px-3 py-1 rounded-full text-[11px] font-mono border flex items-center gap-1.5 ${
              wakeLockActive
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                : 'bg-white/[0.02] text-neutral-500 border-white/[0.06]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                wakeLockActive ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
              }`}
            />
            <span className="hidden sm:inline">
              {wakeLockActive ? 'Pantalla Activa' : 'WakeLock Off'}
            </span>
          </div>

          {/* SSE Connection Status */}
          <div
            className={`px-3 py-1 rounded-full text-[11px] font-mono border flex items-center gap-1.5 ${
              isConnected
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                : 'bg-red-950/40 text-red-300 border-red-800/60 animate-pulse'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            <span className="hidden md:inline">
              {isConnected ? 'En Vivo' : 'Reconectando'}
            </span>
          </div>

          {/* Audio Mute / Unmute Toggle */}
          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            className="w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-neutral-300 flex items-center justify-center transition"
            title={isMuted ? 'Desmutear sonido' : 'Mutear sonido'}
            aria-label={isMuted ? 'Desmutear alertas sonoras' : 'Mutear alertas sonoras'}
          >
            <span className="text-xs font-mono">{isMuted ? 'Muted' : 'Sound'}</span>
          </button>
        </div>
      </header>

      {/* 2. Audio Unlock Gesture Banner */}
      {!audioUnlocked && (
        <div className="bg-[#18181f] border-b border-amber-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-neutral-300">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-mono text-sm">🔔</span>
            <span className="font-light">
              Toca para autorizar el chime sonoro en nuevas comandas.
            </span>
          </div>
          <button
            type="button"
            onClick={handleUnlockAudio}
            className="px-3.5 py-1 bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded-lg font-mono text-[11px] uppercase tracking-wider font-semibold transition active:scale-95 shadow-sm"
          >
            Habilitar Audio
          </button>
        </div>
      )}

      {/* 3. Kanban Lanes Grid */}
      <main className="flex-1 p-6 flex flex-col md:flex-row gap-4 overflow-x-auto">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-6 h-6 border-2 border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
            <p className="text-xs text-neutral-500 font-mono tracking-wider">Conectando al flujo de cocina...</p>
          </div>
        ) : (
          <>
            <KanbanColumn
              title="Pendiente"
              icon="1"
              status="PENDING"
              orders={pendingOrders}
              color="amber"
              onAdvanceStatus={handleAdvanceStatus}
            />

            <KanbanColumn
              title="En Preparación"
              icon="2"
              status="IN_PREP"
              orders={inPrepOrders}
              color="blue"
              onAdvanceStatus={handleAdvanceStatus}
            />

            <KanbanColumn
              title="Listo para Servir"
              icon="3"
              status="READY"
              orders={readyOrders}
              color="emerald"
              onAdvanceStatus={handleAdvanceStatus}
            />

            <KanbanColumn
              title="Despachado"
              icon="4"
              status="SERVED"
              orders={servedOrders}
              color="neutral"
              onAdvanceStatus={handleAdvanceStatus}
            />
          </>
        )}
      </main>
    </div>
  );
}
