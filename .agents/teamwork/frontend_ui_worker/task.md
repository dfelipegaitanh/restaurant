# Frontend UI Worker Task: Implement M2, M3, and M4
Target: Implement the unified frontend for Restaurant POS:
- /mesa/[id]: Customer tablet ordering view (menu catalog, native <dialog> modifier modal, persistent localStorage cart, UUID idempotency key, double-click lock).
- /cocina: Kitchen Display System (real-time Kanban board, SSE stream, synthetic Web Audio chime, Screen Wake Lock API, semáforo timer).
- /caja: Cashier management (table grid, session aggregation, tax/tip math, payment modal, table release).
- app/page.tsx: Hub navigation page linking to tables, kitchen, and cashier.
