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
