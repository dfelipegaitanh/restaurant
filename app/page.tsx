'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [sseConnected, setSseConnected] = useState<boolean | null>(null);
  const [apiOk, setApiOk] = useState<boolean | null>(null);
  const [activeTablesCount, setActiveTablesCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/tables')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setApiOk(true);
          const occupied = data.tables.filter(
            (t: any) => t.status !== 'AVAILABLE' || (t.active_orders && t.active_orders.length > 0)
          ).length;
          setActiveTablesCount(occupied);
        } else {
          setApiOk(false);
        }
      })
      .catch(() => setApiOk(false));

    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/realtime');
      es.onopen = () => setSseConnected(true);
      es.onerror = () => setSseConnected(false);
    } catch {
      setSseConnected(false);
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#09090b] text-neutral-200 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-300 relative overflow-hidden">
      {/* Subtle Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-amber-600/10 via-amber-700/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Navigation Bar */}
      <nav className="border-b border-white/[0.06] bg-[#0c0c0e]/80 backdrop-blur-xl px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-serif font-bold text-lg">
              B
            </div>
            <div>
              <span className="font-medium tracking-tight text-white text-sm">Bistro OS</span>
              <span className="text-[11px] text-neutral-500 font-mono ml-2">v1.0 Prototipo</span>
            </div>
          </div>

          {/* Real-time Health Badges */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-neutral-400">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  apiOk === true ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-neutral-600'
                }`}
              />
              <span className="text-[11px] font-mono">Backend</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-neutral-400">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  sseConnected === true ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse' : 'bg-neutral-600'
                }`}
              />
              <span className="text-[11px] font-mono">SSE Real-Time</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="px-6 pt-16 pb-12 text-center max-w-4xl mx-auto space-y-5">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-medium tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <span>Plataforma Gastronómica de Alta Precisión</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-light tracking-tight text-white font-serif">
          Sincronización táctil <span className="italic font-normal text-amber-200/90">mesa a cocina</span>
        </h1>

        <p className="text-neutral-400 text-sm md:text-base max-w-xl mx-auto font-normal leading-relaxed">
          Autoservicio para comensales con modales nativos fluidos, KDS de cocina reactivo a milisegundos y liquidación en caja sin demoras.
        </p>

        {activeTablesCount !== null && (
          <div className="pt-2">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs text-neutral-300 font-mono">
              <span className="text-neutral-400">Ocupación:</span>
              <strong className="text-white font-medium">
                {activeTablesCount === 0 ? 'Todas las 8 mesas libres' : `${activeTablesCount} de 8 mesas activas`}
              </strong>
            </span>
          </div>
        )}
      </header>

      {/* Core Operational Panels */}
      <section className="max-w-6xl mx-auto w-full px-6 py-6 space-y-10 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Module 1: Cocina (KDS) */}
          <Link
            href="/cocina"
            className="group relative p-8 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.08] hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors pointer-events-none" />

            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl group-hover:scale-105 transition-transform duration-300">
                🍳
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400/90 font-medium">
                  Estación de Despacho
                </span>
                <h2 className="text-2xl font-serif font-medium text-white group-hover:text-amber-200 transition-colors">
                  Pantalla de Cocina (KDS)
                </h2>
                <p className="text-xs md:text-sm text-neutral-400 leading-relaxed font-light">
                  Tablero Kanban con 4 estados, chimes sonoros sintetizados mediante Web Audio API, semáforo de tiempos y Screen Wake Lock activo.
                </p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-neutral-500 font-mono">Tiempo de respuesta: &lt;100ms</span>
              <span className="text-amber-400 group-hover:translate-x-1 transition-transform flex items-center gap-1 font-medium">
                Abrir KDS &rarr;
              </span>
            </div>
          </Link>

          {/* Module 2: Caja y Facturación */}
          <Link
            href="/caja"
            className="group relative p-8 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.08] hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors pointer-events-none" />

            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl group-hover:scale-105 transition-transform duration-300">
                💳
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400/90 font-medium">
                  Administración & Auditoría
                </span>
                <h2 className="text-2xl font-serif font-medium text-white group-hover:text-amber-200 transition-colors">
                  Caja & Liquidación
                </h2>
                <p className="text-xs md:text-sm text-neutral-400 leading-relaxed font-light">
                  Supervisión del salón, consolidación de comandas por sesión, cálculo fiscal con 8% Impoconsumo, 10% propina sugerida y liberación de mesa.
                </p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-neutral-500 font-mono">Multi-método: Efectivo / Tarjeta</span>
              <span className="text-amber-400 group-hover:translate-x-1 transition-transform flex items-center gap-1 font-medium">
                Abrir Caja &rarr;
              </span>
            </div>
          </Link>
        </div>

        {/* Floor Plan / Tablets Grid */}
        <div className="rounded-3xl bg-[#0e0e12]/60 border border-white/[0.06] p-8 space-y-6 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-amber-400 uppercase tracking-widest">Salón Comedor</span>
                <span className="text-xs text-neutral-600">•</span>
                <span className="text-xs text-neutral-400">Plano de Mesas</span>
              </div>
              <h3 className="text-xl font-serif font-medium text-white mt-1">
                Acceso a Tablets de Autoservicio
              </h3>
            </div>
            <span className="text-xs font-mono text-neutral-400 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] w-fit">
              8 Terminales Táctiles
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
              <Link
                key={num}
                href={`/mesa/${num}`}
                className="group p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-amber-500/40 transition-all duration-200 flex flex-col items-center justify-center text-center active:scale-95"
              >
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 group-hover:text-amber-400 transition-colors">
                  Mesa
                </span>
                <span className="text-2xl font-serif font-medium text-white group-hover:text-amber-200 transition-colors">
                  {num}
                </span>
                <span className="text-[9px] text-neutral-600 mt-1 font-mono">
                  Abrir Carta
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="border-t border-white/[0.06] py-8 text-center text-xs text-neutral-600 font-mono">
        Bistro OS &copy; 2026 &mdash; Arquitectura Reactiva Next.js & Tailwind CSS
      </footer>
    </main>
  );
}
