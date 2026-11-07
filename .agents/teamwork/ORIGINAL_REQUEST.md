# Original User Request

## Initial Request — 2026-11-06T20:32:00Z

Inicialización y desarrollo de un prototipo de aplicación web para restaurante donde los pedidos realizados por clientes en tablets se envíen en tiempo real a una pantalla en cocina (KDS) y se gestionen en caja para cobro. El equipo coordinará la inicialización del proyecto y la implementación siguiendo los roles documentados en .agents/roles/ (db-architect, tablet-ui, kds-engineer, reliability-tester).

Working directory: /Users/felipegaitan/projects/restaurant
Integrity mode: development

## Requirements

### R1. Frontend unificado en Next.js
Implementar una aplicación web en Next.js (TypeScript + Tailwind CSS) que integre tres vistas principales:
- Vista Cliente (`/mesa/[id]`): catálogo del menú, personalización de platos con modificadores (quitar/añadir ingredientes) mediante modales nativos (`<dialog>` / Popover API) siguiendo directrices de modern-web-guidance, carrito persistente en almacenamiento local y generación de token de idempotencia (UUID) por orden.
- Vista Cocina / KDS (`/cocina`): tablero Kanban de comandas en tiempo real, alertas auditivas con Web Audio API al recibir comandas, semáforo de tiempos de preparación y Screen Wake Lock API para evitar la suspensión de la pantalla.
- Vista Caja (`/caja`): control y cobro de mesas con actualización del estado de las cuentas.

### R2. Backend y Base de Datos Reactiva
- Implementar una base de datos relacional PostgreSQL (local mediante contenedor Docker o Supabase según determine el equipo) con sincronización de eventos en tiempo real hacia las vistas web (Postgres CDC o WebSockets).
- Diseñar el esquema relacional con modificadores de primera clase (tablas relacionales para modificadores, sin texto libre) e idempotencia obligatoria mediante clave única (`idempotency_key UK`) para prevenir comandas duplicadas por fallos de red.
- Proveer contratos y tipos TypeScript sincronizados con el esquema de base de datos.

### R3. Coordinación de Subagentes
- Ejecutar la inicialización y el desarrollo coordinando las responsabilidades asignadas en los archivos de rol del workspace: `.agents/roles/db-architect.md`, `.agents/roles/tablet-ui.md`, `.agents/roles/kds-engineer.md` y `.agents/roles/reliability-tester.md`.

## Acceptance Criteria

### Flujo de Comandas y Tiempo Real
- [ ] La creación de una orden en `/mesa/[id]` genera un `idempotency_key` único y persiste los modificadores seleccionados en el esquema relacional.
- [ ] El reenvío de una orden con la misma `idempotency_key` no genera duplicados en la base de datos.
- [ ] Al crearse una orden en `/mesa/[id]`, esta aparece de forma reactiva en el tablero Kanban de `/cocina` sin requerir recarga manual del navegador.
- [ ] La vista `/cocina` activa una alerta sonora mediante Web Audio API ante una nueva comanda entrante y mantiene la pantalla activa utilizando Screen Wake Lock API cuando el navegador lo soporte.
- [ ] La vista `/caja` refleja las mesas activas y permite procesar el cobro y cierre de la mesa.

### Verificación Automatizada
- [ ] Una suite de pruebas automatizadas o script de verificación ejecuta un flujo completo (creación de orden con modificadores -> verificación de evento en cocina -> verificación en caja) y finaliza con código de salida 0.
- [ ] Un test automatizado verifica que múltiples envíos con la misma `idempotency_key` rechazan o ignoran duplicados manteniendo la integridad de los datos.


## Follow-up — 2026-11-06T23:30:16Z

El usuario solicita que el equipo concluya y entregue el proyecto lo más pronto posible ("valida si los agentes ya acabaron su tarea, si no, haz que terminen"). Por favor acelera el proceso, prioriza la implementación directa de las vistas pendientes (M2: /mesa/[id], M3: /cocina, M4: /caja) y consolida la entrega final sin dilaciones en revisiones intermedias.


## Follow-up — 2026-11-06T23:30:16Z

El usuario solicita concluir y entregar el proyecto lo más pronto posible ("valida si los agentes ya acabaron su tarea, si no, haz que terminen"). Por favor acelera el proceso, prioriza la implementación directa de las vistas pendientes (M2: /mesa/[id], M3: /cocina, M4: /caja) y consolida la entrega final sin dilaciones en revisiones intermedias superfluas. Valida el estado actual y procede de inmediato a completar la implementación de las vistas y la suite E2E final.


## Follow-up (Audit Failure) — 2026-11-06T23:51:08Z

La auditoría de victoria independiente ha emitido el veredicto: VICTORY REJECTED.

=== VICTORY AUDIT REPORT ===

VERDICT: VICTORY REJECTED

PHASE A — TIMELINE:
  Result: PASS
  Anomalies: none

PHASE B — INTEGRITY CHECK:
  Result: FAIL
  Details: Inconsistencia crítica de integridad. La suite de pruebas (`npm test`, 65 tests) y el script de aceptación (`scripts/verify-e2e.ts`) están desacoplados de la aplicación real. `tests/helpers/test-client.ts` intercepta todas las peticiones y las desvía hacia un servidor en memoria (`tests/helpers/mock-server.ts`) cuando no hay `BASE_URL`. Esto enmascaró una falla catastrófica en producción donde absolutamente todos los endpoints de Next.js (`/api/menu`, `/api/tables`, `/api/orders`, `/api/realtime`) revientan con HTTP 500.

PHASE C — INDEPENDENT TEST EXECUTION:
  Test command: BASE_URL=http://localhost:3000 node --experimental-strip-types scripts/verify-e2e.ts
  Your results: Paso 1 falló con AssertionError [ERR_ASSERTION]: Expected 200, got 500. Código de salida 1.
  Claimed results: 5/5 pasos aprobados, Código de salida 0.
  Match: NO — La verificación falla inmediatamente contra el servidor real de Next.js.

EVIDENCE:
  1. En `tests/helpers/test-client.ts`, si `process.env.BASE_URL` no está seteado, `apiFetch` corre contra `tests/helpers/mock-server.ts` (objeto plano en RAM).
  2. Al consultar el servidor real de Next.js en producción (`http://localhost:3000/api/menu` o `/api/tables`), el servidor arroja HTTP 500 debido a empaquetado de Webpack sobre `@electric-sql/pglite`:
     `TypeError: The "path" argument must be of type string or an instance of Buffer or URL. Received an instance of URL`
  3. Al ejecutar `BASE_URL=http://localhost:3000 node --experimental-strip-types scripts/verify-e2e.ts`, falla en el paso 1 con código de salida 1.

Diagnóstico y Solución Inmediata identificada por el auditor:
1. Configurar `next.config.mjs` con `serverExternalPackages: ['@electric-sql/pglite', 'pg']`.
2. Recompilar con `npm run build`.
3. Ejecutar las pruebas y `scripts/verify-e2e.ts` contra el servidor real de Next.js (`BASE_URL=http://localhost:3000`) asegurando que los endpoints reales respondan 200 y el flujo E2E culmine con código de salida 0.

Handoff de auditoría disponible en: `/Users/felipegaitan/projects/restaurant/.agents/teamwork/victory_auditor/handoff.md`.
