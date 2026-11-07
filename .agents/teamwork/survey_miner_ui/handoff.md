# Handoff Report: Frontend UI & KDS Specification Mining

**Date:** 2026-11-06T20:36:30Z  
**Author:** teamwork_spec_miner (Frontend UI & KDS Specialist)  
**Target:** Orchestrator & Frontend Engineering Roles (`tablet-ui`, `kds-engineer`)  
**Type:** Hard Handoff (Task Complete)  

---

## 1. Observation
1. **`ORIGINAL_REQUEST.md` (lines 12–16)**:
   > "Implementar una aplicación web en Next.js (TypeScript + Tailwind CSS) que integre tres vistas principales:
   > - Vista Cliente (`/mesa/[id]`): catálogo del menú, personalización de platos con modificadores (quitar/añadir ingredientes) mediante modales nativos (`<dialog>` / Popover API) siguiendo directrices de modern-web-guidance, carrito persistente en almacenamiento local y generación de token de idempotencia (UUID) por orden.
   > - Vista Cocina / KDS (`/cocina`): tablero Kanban de comandas en tiempo real, alertas auditivas con Web Audio API al recibir comandas, semáforo de tiempos de preparación y Screen Wake Lock API para evitar la suspensión de la pantalla.
   > - Vista Caja (`/caja`): control y cobro de mesas con actualización del estado de las cuentas."

2. **`.agents/roles/tablet-ui.md` (lines 10–14)**:
   > "1. **Modales Nativos:** Usar exclusivamente el elemento nativo `<dialog>` con `showModal()` o la Popover API para selección de modificadores. Prohibido instalar librerías pesadas de React.
   > 2. **Touch Targets Ergonómicos:** Botones táctiles con un área mínima de 48px x 48px.
   > 3. **Persistencia Local:** Carrito de compras respaldado en `localStorage` o `IndexedDB` para no perder pedidos si la tablet se recarga.
   > 4. **Token de Idempotencia:** Generar un UUID único por orden antes de disparar el envío al backend."

3. **`.agents/roles/kds-engineer.md` (lines 10–14)**:
   > "1. **Screen Wake Lock API:** Mantener la pantalla activa sin permitir que el sistema operativo de la tablet la suspenda o apague durante el servicio.
   > 2. **View Transitions API:** Transiciones nativas a 60 FPS para el desplazamiento de comandas entre carriles de estado.
   > 3. **Alertas Auditivas Sintéticas:** Generar sonido de notificación con Web Audio API en cada comanda entrante (sin dependencias de archivos MP3).
   > 4. **Semáforo Visual de Tiempos:** Verde (<10 min), Naranja (10-20 min), Rojo (>20 min)."

4. **`.agents/roles/db-architect.md` (lines 10–13)**:
   > "1. **Modificadores Relacionales:** Jamás guardar personalizaciones ("sin cebolla", "extra salsa") como texto libre. Se modelan en tablas relacionales (`modifier_groups`, `modifiers`, `order_item_modifiers`).
   > 2. **Idempotencia Obligatoria:** Toda orden exige un `idempotency_key` (UUID) para prevenir comandas duplicadas por fallos de Wi-Fi.
   > 3. **Estados de Comanda:** `PENDING`, `IN_PREP`, `READY`, `SERVED`, `CANCELLED`."

5. **Sandbox Environment Check**:
   Executed `run_command` attempting `npx -y modern-web-guidance@latest list`: returned `npm error 403 Forbidden - GET https://registry.npmjs.org/modern-web-guidance`. Confirmed that external registry is blocked in current sandbox mode, requiring relying on standard web specifications and local skill documentation.

---

## 2. Logic Chain
1. From Observation 1 and Observation 2, the Customer Tablet UI (`/mesa/[id]`) must strictly prohibit external UI packages like Radix, Floating UI, or MUI for modals. It must use the native `<dialog>` element with `.showModal()`, light-dismiss via backdrop click coordinate calculation, and keyboard ESC cancellation.
2. From Observation 2 and Observation 4, modifiers cannot be free-text strings; each modifier selection in the `<dialog>` modal must bind directly to a relational `modifier_id`. The client cart must compute line items as composite keys of `item_id` and sorted `modifier_ids` to distinguish variations of the same dish on kitchen tickets.
3. From Observation 1, Observation 2, and Observation 4, checkout must generate a client-side UUID v4 (`crypto.randomUUID()`) as `idempotency_key`. The checkout UI state machine must disable the submit button immediately upon touch, preventing duplicate clicks. On network retry, the identical `idempotency_key` must be resent so the backend recognizes it as an existing request.
4. From Observation 1 and Observation 3, the Kitchen Display System (`/cocina`) requires zero external media files. The Web Audio API must synthesize dual audio tones (e.g. D5 587.33Hz followed by A5 880Hz) via `OscillatorNode` and `GainNode`. To comply with browser autoplay restrictions, an "Activar Audio" unlock banner must resume the `AudioContext` on first user gesture.
5. From Observation 3, kitchen tablets must remain awake indefinitely. The `Screen Wake Lock API` (`navigator.wakeLock.request('screen')`) must be used with automatic re-acquisition on `document.visibilitychange` to restore lock if the tab is minimized or switched.
6. From Observation 3 and Observation 4, the KDS Kanban columns correspond to `PENDING`, `IN_PREP`, `READY`, and `SERVED`. Card transitions between columns must invoke `document.startViewTransition` when supported for 60 FPS transitions.
7. From Observation 3, comanda cards must render a 3-tier time semáforo based on elapsed minutes from `order.created_at`: Green (<10 min), Orange (10-20 min), Red (>20 min).
8. From Observation 1, the Cashier interface (`/caja`) must provide table oversight, aggregate all separate order submissions for a table session into a single account, calculate tax and tip, process payment (Cash, Card, Transfer), and release the table.

---

## 3. Caveats
- Browser compatibility for `Screen Wake Lock API`: While supported on Chromium and Safari 16.4+, some older Android tablets or browsers may reject the request. The UI specification includes a graceful fallback warning rather than crashing.
- Browser compatibility for `View Transitions API`: Currently standard in Chromium and Safari 18+; fallback detection `('startViewTransition' in document)` executes synchronous DOM mutation when missing.
- Web Audio API Autoplay: Browsers strictly require user activation before sound playback. If the kitchen tablet boots directly to `/cocina` without interaction, alerts will be muted until the cook taps the screen or the "Activar Audio" banner.

---

## 4. Conclusion
The frontend UI and KDS specifications are completely mapped, validated against project constraints, and compiled in:
- `/Users/felipegaitan/projects/restaurant/.agents/teamwork/survey_miner_ui/report.md`

All 26 features, 12 edge cases, native API contracts, client state machines, and Next.js component architectures are fully documented and ready for implementation by `tablet-ui` and `kds-engineer`.

---

## 5. Verification Method
1. Inspect the full specification report:
   `view_file` on `/Users/felipegaitan/projects/restaurant/.agents/teamwork/survey_miner_ui/report.md`
2. Verify all 4 acceptance criteria in `ORIGINAL_REQUEST.md` lines 29–33 are addressed:
   - Line 29 (Idempotency & Modifiers): See Sections 2 (#4, #5, #9) and 4.2, 4.3 in report.md.
   - Line 31 (Reactiveness in `/cocina`): See Sections 2 (#12, #13) and 5.1 in report.md.
   - Line 32 (Web Audio & Screen Wake Lock): See Sections 2 (#14, #15) and 5.2, 5.3 in report.md.
   - Line 33 (Cashier billing & closure): See Sections 2 (#21–#25) and 6.1 in report.md.
3. Invalidation Conditions:
   - If requirements change to require free-form customer kitchen notes, Section 4.2 and Section 8.2 must be revised.
   - If an external UI library (e.g. Radix UI or Tailwind UI kit) is mandated instead of native `<dialog>`, Rule 1 in `tablet-ui.md` must be officially updated.
