# Handoff Report: survey_miner_db (Base de Datos y Backend Reactivo)

**Subagente:** `survey_miner_db` (`db-architect`)  
**Fecha:** 2026-11-06T20:37:00Z  
**Tipo de Handoff:** Hard (Tarea completada satisfactoriamente)  
**Destinatario:** Orchestrator (`e84a0498-4ac6-43a7-b21c-e535e5df7fca`)

---

## 1. Observation

1. **Requisitos Mandatorios en `ORIGINAL_REQUEST.md`:**
   - Líneas 18-22: *"R2. Backend y Base de Datos Reactiva: Implementar una base de datos relacional PostgreSQL (local mediante contenedor Docker o Supabase según determine el equipo) con sincronización de eventos en tiempo real hacia las vistas web (Postgres CDC o WebSockets). Diseñar el esquema relacional con modificadores de primera clase (tablas relacionales para modificadores, sin texto libre) e idempotencia obligatoria mediante clave única (`idempotency_key UK`) para prevenir comandas duplicadas por fallos de red. Proveer contratos y tipos TypeScript sincronizados con el esquema de base de datos."*
   - Líneas 29-33: Criterios de aceptación para `idempotency_key`, persistencia de modificadores en esquema relacional, rechazo/ignorado de duplicados, y visualización reactiva en `/cocina` y `/caja`.
2. **Reglas Operativas en `.agents/roles/db-architect.md`:**
   - Líneas 10-15:
     - Regla 1: *"Modificadores Relacionales: Jamás guardar personalizaciones ('sin cebolla', 'extra salsa') como texto libre. Se modelan en tablas relacionales (`modifier_groups`, `modifiers`, `order_item_modifiers`)."*
     - Regla 2: *"Idempotencia Obligatoria: Toda orden exige un `idempotency_key` (UUID) para prevenir comandas duplicadas por fallos de Wi-Fi."*
     - Regla 3: *"Estados de Comanda: `PENDING`, `IN_PREP`, `READY`, `SERVED`, `CANCELLED`."*
     - Regla 4: *"Contratos TypeScript: Generar definiciones de tipos sincronizadas al 100% con las tablas."*
3. **Observación del Entorno Host de Ejecución:**
   - Comando ejecutado: `node -v && npm -v && docker -v`
     - Salida: `v22.11.0`, `10.9.0`, `zsh:1: command not found: docker` (Código de salida: 127).
   - Comando ejecutado: `which docker || ls /usr/local/bin/docker || ls /opt/homebrew/bin/docker || ls -d /Applications/Docker.app`
     - Salida: `docker not found`, `ls: /usr/local/bin/docker: No such file or directory`, `ls: /opt/homebrew/bin/docker: No such file or directory`, `ls: /Applications/Docker.app: No such file or directory` (Código de salida: 1).
   - Comando ejecutado: `brew list`
     - Salida: No contiene `postgresql` ni `docker` instalados localmente.

---

## 2. Logic Chain

1. **Premisa 1 (Regla de Modificadores de Primera Clase):** La prohibición estricta de guardar notas en texto libre exige que cualquier cambio a un plato (como "sin cebolla" o "extra queso") se descomponga en tuplas relacionales normalizadas. Por lo tanto, el modelo debe contar con:
   - `modifier_groups`: Define grupos (ej. "Término de la carne", "Sin ingredientes", "Adiciones extra") con restricciones de cardinalidad (`min_selection`, `max_selection`).
   - `product_modifier_groups`: Junction table N:M que asocia qué grupos aplican a qué productos.
   - `modifiers`: Opciones atómicas con `action_type` (`NO`, `EXTRA`, `OPTION`, `SUBSTITUTE`) y `price_delta`.
   - `order_item_modifiers`: Persistencia relacional de cada modificador escogido en cada línea de pedido con snapshot de su precio unitario delta.
2. **Premisa 2 (Idempotencia y Resiliencia ante Ráfagas):**
   - El cliente genera un UUID v4 (`idempotency_key`) antes de emitir la petición.
   - En PostgreSQL, la columna `idempotency_key UUID UNIQUE` en la tabla `orders` garantiza atomicidad a nivel de motor.
   - Si se reciben 5 clics rápidos en 50ms, la primera petición inserta la orden y los ítems; las 4 subsecuentes colisionan con la restricción `UNIQUE` (`ON CONFLICT (idempotency_key) DO NOTHING`) y retornan HTTP 200 con la orden ya existente y cabecera `X-Idempotent-Replay: true`, impidiendo tickets dobles en la cocina.
3. **Premisa 3 (Sincronización en Tiempo Real):**
   - El backend debe notificar a `/cocina` (KDS) en <100ms sin recargar la página.
   - PostgreSQL provee `LISTEN/NOTIFY` mediante triggers PL/pgSQL.
   - En el entorno web Next.js, Server-Sent Events (SSE) en `/api/realtime` es el canal de transporte más ligero y robusto, con reconexión automática nativa en navegador (`EventSource`) y cero dependencias de brokers externos.
4. **Premisa 4 (Solución al Runtime sin Docker):**
   - Puesto que Docker no está disponible en la máquina anfitriona y PostgreSQL nativo tampoco está instalado, requerir Docker bloquearía al equipo de desarrollo y las pruebas automatizadas.
   - La solución superior es dar soporte dual en la capa de base de datos:
     a) PostgreSQL estándar (usando cadena `DATABASE_URL` para Supabase o Postgres local cuando exista).
     b) `@electric-sql/pglite` (PostgreSQL 16 en WebAssembly puro dentro de Node.js) como driver embebido sin dependencias externas, ideal para desarrollo local inmediato y ejecución de pruebas E2E con código de salida 0.

---

## 3. Caveats

1. **Docker Ausente:** No se puede asumir que `docker run` o `docker compose up` funcionen en el entorno local del usuario sin intervención previa de instalación. Se debe priorizar o permitir soporte con `@electric-sql/pglite` o conexión remota a Supabase.
2. **WebSocket vs SSE en Serveless:** Si Next.js se despliega en entornos puramente serverless (e.g. Vercel con límites de ejecución), SSE de larga duración o WebSockets requieren un servicio stateful o Supabase Realtime. Para el servidor local de desarrollo (`next start` o `node server.js`), SSE funciona de forma 100% nativa.

---

## 4. Conclusion

El diseño de la base de datos y backend reactivo está completamente especificado, verificado y documentado en `.agents/teamwork/survey_miner_db/report.md`. Cumple al 100% con:
1. Esquema relacional estricto con modificadores de primera clase (tablas normalizadas, cero texto libre).
2. Idempotencia atómica garantizada mediante `idempotency_key UUID UNIQUE` y manejo de conflicto sin duplicación.
3. Arquitectura reactiva en tiempo real vía triggers `LISTEN/NOTIFY` y SSE hacia KDS y Caja.
4. Contratos de tipos TypeScript sincronizados e integrados para todo el stack.
5. Estrategia de migración y datos semilla para 8 mesas y menú completo de restaurante.

---

## 5. Verification Method

Para verificar independientemente este trabajo:
1. Inspeccionar el reporte detallado en:
   `/Users/felipegaitan/projects/restaurant/.agents/teamwork/survey_miner_db/report.md`
2. Validar que el DDL SQL de la sección 4 de `report.md` contenga:
   - `orders(idempotency_key UUID NOT NULL UNIQUE)`
   - Tablas `modifier_groups`, `modifiers`, `product_modifier_groups`, `order_item_modifiers`.
   - Estados de comanda: `CHECK (status IN ('PENDING', 'IN_PREP', 'READY', 'SERVED', 'CANCELLED'))`.
3. Verificar que los contratos TypeScript cubran todas las interfaces y eventos en tiempo real.
