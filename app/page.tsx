'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [sseConnected, setSseConnected] = useState<boolean | null>(null);

  useEffect(() => {
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
      {/* Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-amber-600/10 via-amber-700/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Navigation Bar */}
      <nav className="border-b border-white/[0.06] bg-[#0c0c0e]/80 backdrop-blur-xl px-6 py-4 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-serif font-bold text-lg">
              B
            </div>
            <div>
              <span className="font-semibold tracking-tight text-white text-base">Bistro OS</span>
              <span className="text-[11px] text-amber-400 font-mono ml-2 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                Fast-Casual
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <Link
              href="/db"
              className="px-3 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-neutral-300 hover:text-white transition-all font-mono text-[11px] flex items-center gap-1.5"
            >
              <span>🗄️</span>
              <span>Explorador BD</span>
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-neutral-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  sseConnected === true
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse'
                    : 'bg-neutral-600'
                }`}
              />
              <span className="text-[11px] font-mono">
                {sseConnected === true ? 'SSE Conectado' : 'SSE Desconectado'}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="px-6 pt-20 pb-14 text-center max-w-4xl mx-auto space-y-5">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-medium tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <span>Colombian Street Food & Comfort Fusion</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-light tracking-tight text-white font-serif">
          Autoservicio <span className="italic font-normal text-amber-200/90">& Cocina KDS</span>
        </h1>

        <p className="text-neutral-400 text-sm md:text-base max-w-2xl mx-auto font-normal leading-relaxed">
          Pide en la tablet de entrada de pie, genera tu número de turno secuencial en CAD y despacha en cocina en tiempo real a milisegundos.
        </p>
      </header>

      {/* Core Stations Grid */}
      <section className="max-w-5xl mx-auto w-full px-6 py-6 space-y-8 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Kiosk Card */}
          <Link
            href="/kiosko"
            className="group relative p-8 rounded-2xl bg-gradient-to-b from-amber-500/[0.08] to-transparent border border-amber-500/20 hover:border-amber-500/50 transition-all duration-300 flex flex-col justify-between shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-colors pointer-events-none" />

            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform duration-300">
                📱
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-semibold">
                  Terminal de Entrada
                </span>
                <h2 className="text-2xl font-serif font-medium text-white group-hover:text-amber-200 transition-colors">
                  Kiosko de Autoservicio (/kiosko)
                </h2>
                <p className="text-xs md:text-sm text-neutral-400 leading-relaxed font-light">
                  Catálogo táctil con las 6 categorías: Hamburguesas criollas, perros calientes, salchipapas, acompañamientos y bebidas en CAD. Tap directo para añadir y generación instantánea de ticket de turno.
                </p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-neutral-500 font-mono">Entrada Comensales</span>
              <span className="text-amber-400 group-hover:translate-x-1 transition-transform flex items-center gap-1 font-medium">
                Abrir Kiosko →
              </span>
            </div>
          </Link>

          {/* KDS Card */}
          <Link
            href="/cocina"
            className="group relative p-8 rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/[0.08] hover:border-amber-500/40 transition-all duration-300 flex flex-col justify-between shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-colors pointer-events-none" />

            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-3xl group-hover:scale-105 transition-transform duration-300">
                🍳
              </div>
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400/90 font-medium">
                  Estación de Despacho
                </span>
                <h2 className="text-2xl font-serif font-medium text-white group-hover:text-amber-200 transition-colors">
                  Pantalla de Cocina (/cocina)
                </h2>
                <p className="text-xs md:text-sm text-neutral-400 leading-relaxed font-light">
                  Tablero Kanban conectado por SSE. Timbre de audio sintetizado con Web Audio API en cada nuevo pedido, semáforo de tiempos por ticket y avance de estado con un clic.
                </p>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-neutral-500 font-mono">SSE en Tiempo Real</span>
              <span className="text-amber-400 group-hover:translate-x-1 transition-transform flex items-center gap-1 font-medium">
                Abrir Cocina →
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6 px-6 text-center text-xs text-neutral-500 font-mono">
        Bistro OS © 2026 — Pure Fast-Casual Platform
      </footer>
    </main>
  );
}
