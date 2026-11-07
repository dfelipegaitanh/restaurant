# Handoff Report: Milestone 1 (Idempotency & API Handlers)

**Author:** teamwork_explorer (`m1_explorer_2`)  
**Date:** 2026-11-06T20:45:00Z  
**Type:** Hard Handoff  
**Working Directory:** `/Users/felipegaitan/projects/restaurant/.agents/teamwork/m1_explorer_2/`  

---

## 1. Observation

1. **Requerimientos de Idempotencia y Concurrencia:**
   - En `.agents/teamwork/ORIGINAL_REQUEST.md` (líneas 18-20, 28-30, 37):
     > "Diseñar el esquema relacional con modificadores de primera clase... e idempotencia obligatoria mediante clave única (idempotency_key UK) para prevenir comandas duplicadas por fallos de red."  
     > "- [ ] La creación de una orden en /mesa/[id] genera un idempotency_key único y persiste los modificadores seleccionados en el esquema relacional."  
     > "- [ ] El reenvío de una orden con la misma idempotency_key no genera duplicados en la base de datos."  
     > "- [ ] Un test automatizado verifica que múltiples envíos con la misma idempotency_key rechazan o ignoran duplicados manteniendo la integridad de los datos."
   - En `.agents/roles/reliability-tester.md`:
     > "1. Idempotencia a Toda Prueba: Simular ráfagas de 5 clics rápidos en 'Confirmar Pedido' para verificar que solo se procese 1 comanda."

2. **Diseño de Endpoints y Contratos en PROJECT.md:**
   - En `.agents/teamwork/PROJECT.md` (líneas 142-153):
     > "- GET /api/menu: Returns list of categories and products with nested modifier_groups."  
     > "- GET /api/tables: Returns list of tables with current status and active orders."  
     > "- POST /api/orders: Headers: Content-Type: application/json."  
     > "  - Body: CreateOrderRequest."  
     > "  - Success (201 Created): { success: true, order: OrderSummary, replayed: false }."  
     > "  - Replay (200 OK): Header X-Idempotent-Replay: true, { success: true, order: OrderSummary, replayed: true }."  
     > "- PATCH /api/orders/[id]/status: Body { status: OrderStatus }."

3. **Restricciones del Rol db-architect:**
   - En `.agents/roles/db-architect.md` (líneas 10-14):
     > "1. Modificadores Relacionales: Jamás guardar personalizaciones ('sin cebolla', 'extra salsa') como texto libre. Se modelan en tablas relacionales (modifier_groups, modifiers, order_item_modifiers)."  
     > "2. Idempotencia Obligatoria: Toda orden exige un idempotency_key (UUID) para prevenir comandas duplicadas por fallos de Wi-Fi."  
     > "3. Estados de Comanda: PENDING, IN_PREP, READY, SERVED, CANCELLED."  
     > "4. Contratos TypeScript: Generar definiciones de tipos sincronizadas al 100% con las tablas."

4. **Entorno de Ejecución Host:**
   - En `survey_explorer_infra/report.md` (líneas 34-45):
     > Node.js `v22.11.0` (LTS), npm `10.9.0`, Darwin x86_64.  
     > Docker Engine NO instalado en el host, PostgreSQL local no instalado en Homebrew.  
     > Solución adoptada: Dual-mode DB con `@electric-sql/pglite` (WASM Postgres 16) y `pg` estándar cuando `DATABASE_URL` está definido.

5. **Transición Asíncrona de Parámetros en Next.js 15:**
   - En Next.js 15 App Router, los parámetros dinámicos de ruta en route handlers (`{ params }: { params: Promise<{ id: string }> }`) son asíncronos y requieren `await params` antes de acceder a `id`.

---

## 2. Logic Chain

1. **De la Observación 1 a la Arquitectura de Idempotencia Atómica:**
   - Para prevenir duplicados bajo una ráfaga concurrente de 5 clics en 50ms (requerimiento de `reliability-tester`), un chequeo simple `SELECT ... WHERE idempotency_key = $key` previo a la inserción es susceptible a una condición de carrera (ambas peticiones leen 0 filas simultáneamente y ambas intentan insertar).
   - Por lo tanto, la garantía debe residir a nivel relacional en el motor PostgreSQL: `orders.idempotency_key UUID NOT NULL UNIQUE`.
   - La inserción atómica debe emplear `INSERT INTO orders ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING ...` o atrapar la excepción de Postgres `23505 (unique_violation)`.
   - Si se detecta conflicto, la transacción secundaria realiza `ROLLBACK` (o se aborta), se recupera la orden original con sus ítems y modificadores de la base de datos, y se devuelve `HTTP 200 OK` con la cabecera `X-Idempotent-Replay: true` y `{ success: true, order: existingOrder, replayed: true }`.
   - Además, al ser un replay, **se suprime la emisión del evento SSE `ORDER_CREATED`**, evitando que la pantalla de cocina (`/cocina`) imprima o suene una segunda comanda.

2. **De la Observación 2 y 3 a la Validación de Modificadores Relacionales:**
   - Dado que los modificadores no pueden ser texto libre, el payload de `POST /api/orders` debe incluir identificadores UUID de modificadores (`modifier_id`).
   - El backend debe validar en servidor la cardinalidad (`min_selection`, `max_selection`) por cada grupo de modificadores asociado al producto pedido (`product_modifier_groups`).
   - Para evitar fraude o manipulación en cliente, los precios unitarios se calculan estrictamente en servidor: `product.base_price + sum(modifier.price_delta)`.

3. **De la Observación 2 y 5 al Handler Dinámico `PATCH /api/orders/[id]/status`:**
   - La máquina de estados finita debe rechazar saltos ilegales (ej. `PENDING` a `SERVED`) devolviendo `HTTP 400 Bad Request`.
   - En Next.js 15, `params` debe resolverse con `await params` para extraer `id`.
   - Al actualizar con éxito, se ejecuta `eventHub.broadcast({ type: 'ORDER_STATUS_CHANGED', payload: ... })` notificando reactivamente al KDS y la tablet.

4. **De la Observación 2 y 3 al Diseño de Contratos en `types/domain.ts`:**
   - Se crearon tipos y enums unificados (`OrderStatus`, `TableStatus`, `ModifierAction`, `BillStatus`, `PaymentMethod`, `CreateOrderRequest`, `OrderSummary`, etc.) que satisfacen simultáneamente el DDL de `m1_explorer_1`, el emisor SSE de `m1_explorer_3` y las pruebas de `e2e_test_writer`.

---

## 3. Caveats

1. **Dependencia de la Capa de Base de Datos (`m1_explorer_1`):**
   - El código de los handlers asume que `lib/db/index.ts` expone un método `getDb()` que devuelve un cliente compatible con transacciones SQL (`BEGIN`, `COMMIT`, `ROLLBACK`, `query(text, params)`).
2. **Dependencia del Broadcaster SSE (`m1_explorer_3`):**
   - El código asume que `lib/events/eventHub.ts` es un singleton exportado que contiene el método `broadcast(event: RealtimeEvent)`.
3. **Manejo de Parámetros en Next.js 14 vs 15:**
   - El diseño asume Next.js 15 (donde `params` es una Promise). Si el setup final de `m1_explorer_1` fijara Next.js 14, `await params` sigue siendo válido en JavaScript pero el tipo TypeScript se ajustaría a `{ params: { id: string } }`.

---

## 4. Conclusion

El diseño técnico e implementación de los handlers de API y el protocolo de idempotencia para Milestone 1 queda completamente definido y especificado en `/Users/felipegaitan/projects/restaurant/.agents/teamwork/m1_explorer_2/report.md`.
Incluye:
- Manejo atómico y a prueba de carreras para `POST /api/orders` con `idempotency_key UUID UNIQUE`, retorno 201 en creación y 200 + `X-Idempotent-Replay: true` en duplicados.
- Handler `GET /api/menu` con árbol relacional completo (`Category -> Product -> ModifierGroup -> Modifier`).
- Handler `GET /api/tables` con estado de ocupación y agregación de órdenes activas.
- Handler `PATCH /api/orders/[id]/status` con validación estricta de máquina de estados (`PENDING` -> `IN_PREP` -> `READY` -> `SERVED`).
- Contratos TypeScript canónicos en `types/domain.ts`.

---

## 5. Verification Method

Para verificar independientemente la validez y consistencia del diseño propuesto:

1. **Inspección de Archivos Generados:**
   - Revisar `/Users/felipegaitan/projects/restaurant/.agents/teamwork/m1_explorer_2/report.md`.
   - Comprobar que los tipos en `types/domain.ts` cubren todas las interfaces requeridas por `PROJECT.md` y `ORIGINAL_REQUEST.md`.
2. **Validación del Algoritmo de Idempotencia:**
   - Comprobar que `POST /api/orders` maneja la condición de carrera con `ON CONFLICT (idempotency_key) DO NOTHING` y captura de error Postgres `23505`.
   - Comprobar que el replay devuelve cabecera `X-Idempotent-Replay: true` y no invoca `eventHub.broadcast`.
3. **Comando de Test Automatizado del Proyecto (al ser implementado en M1):**
   ```bash
   npm run test:idempotency
   # o bien:
   node --experimental-strip-types --test tests/integration/idempotency.test.ts
   ```
4. **Condición de Invalidación:**
   - Si un envío concurrente de 5 peticiones con el mismo `idempotency_key` inserta más de 1 comanda en la tabla `orders` o genera más de un evento `ORDER_CREATED` en el SSE, el protocolo de idempotencia se considera invalidado.
