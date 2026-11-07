# Especificación Técnica de Base de Datos y Backend Reactivo (R2)

**Autor:** Subagente de Datos y Contratos (`survey_miner_db` / `db-architect`)  
**Fecha:** 2026-11-06  
**Proyecto:** Sistema POS / KDS Restaurante en Tiempo Real  
**Fuentes de Verificación:** `.agents/teamwork/ORIGINAL_REQUEST.md`, `.agents/roles/db-architect.md`, `.agents/roles/tablet-ui.md`, `.agents/roles/kds-engineer.md`, `.agents/roles/reliability-tester.md`.

---

## 1. Resumen Ejecutivo y Diagnóstico del Entorno

Este documento define la especificación canónica, formal e innegociable de la capa de datos y el backend reactivo para el sistema de restaurante. 

> [!WARNING]
> **Riesgo Bloqueante de Entorno (Docker No Encontrado):**
> Tras auditar el host (`node v22.11.0`, `npm 10.9.0`), se constató que **Docker no está instalado en el PATH ni en `/Applications/Docker.app`**, ni existe servicio local de PostgreSQL activo en Homebrew.  
> **Solución técnica recomendada:** Para no bloquear el desarrollo ni exigir instalaciones pesadas de Docker Desktop, se especifica soporte dual:
> 1. Conexión estándar a PostgreSQL (compatible con Supabase cloud o contenedor Docker cuando esté disponible).
> 2. Motor embebido **`@electric-sql/pglite`** (PostgreSQL 16 compilado a WebAssembly en Node.js puro, con soporte completo de SQL, tipos UUID y transacciones sin requerir daemon externo).

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Tables & Mesas | Gestión de Mesas del Restaurante | Registro de mesas físicas (`tables`), capacidad, código identificador y estado del ciclo de vida (`AVAILABLE`, `OCCUPIED`, `BILL_REQUESTED`, `CLOSED`). | `table_number` (string/int), `capacity` (int) | Registro persistido de mesa con UUID PK | Rechazo de `table_number` duplicado (`23505 unique_violation`). | ORIGINAL_REQUEST.md R1/R2, db-architect.md |
| 2 | Catalog | Categorías y Productos | Catálogo jerárquico de platos (`categories`, `products`) con precios base, descripción, estado activo y orden de visualización. | Datos de plato (`name`, `category_id`, `base_price`, etc.) | UUID del plato, registro relacional | Error de FK si `category_id` no existe; error de Check si `base_price < 0`. | ORIGINAL_REQUEST.md R1, db-architect.md |
| 3 | Modifiers | Grupos de Modificadores de Primera Clase | Agrupación relacional de modificadores (`modifier_groups`) con reglas de cardinalidad: selección mínima obligatoria (`min_selection`) y máxima (`max_selection`). Prohíbe texto libre. | `name`, `min_selection`, `max_selection` | Grupo de modificador con UUID PK | Rechazo si `min_selection > max_selection` o valores negativos. | db-architect.md Regla 1, reliability-tester.md |
| 4 | Modifiers | Opciones Atómicas de Modificador | Opciones individuales (`modifiers`) ligadas a un grupo, con tipo de acción explícita (`NO`, `EXTRA`, `OPTION`, `SUBSTITUTE`) y delta de precio (`price_delta`). | `group_id`, `name`, `price_delta`, `action_type` | Opción relacional persistida | Validación de `action_type` contra ENUM/CHECK; `price_delta >= 0`. | db-architect.md Regla 1, ORIGINAL_REQUEST.md R2 |
| 5 | Modifiers | Asociación Producto - Grupos | Tabla intermedia (`product_modifier_groups`) que define qué grupos aplican a qué productos y su orden en la interfaz modal. | `product_id`, `modifier_group_id`, `display_order` | Vínculo relacional N:M | FK constraint violation si producto o grupo no existen; UK compuesta. | db-architect.md Regla 1, tablet-ui.md |
| 6 | Orders | Registro de Comanda con Idempotencia | Cabecera de comanda (`orders`) con `idempotency_key` (UUID) obligatorio y único, vinculada a una mesa, cálculo de total y estado inicial `PENDING`. | `table_id`, `idempotency_key` (UUID), lista de ítems | Registro de orden con estados: `PENDING`, `IN_PREP`, `READY`, `SERVED`, `CANCELLED` | Violación de clave única (`23505`) en `idempotency_key`. Manejo seguro sin duplicar comanda. | db-architect.md Regla 2 y 3, ORIGINAL_REQUEST.md R2 |
| 7 | Order Items | Líneas de Comanda con Snapshot de Precio | Detalle de platos pedidos (`order_items`) con cantidad y snapshot de precio unitario en el instante de la transacción. | `order_id`, `product_id`, `quantity`, `unit_price` | UUID de línea de ítem, subtotal calculado | Rechazo si `quantity <= 0` o `unit_price < 0`. | db-architect.md, ORIGINAL_REQUEST.md R2 |
| 8 | Order Item Modifiers | Modificadores Seleccionados en Ítem | Tabla relacional (`order_item_modifiers`) que asocia cada modificador seleccionado con la línea de ítem, con snapshot de `unit_price_delta`. | `order_item_id`, `modifier_id`, `unit_price_delta` | Vínculo relacional persistido sin texto libre | Rechazo de duplicados (`UNIQUE(order_item_id, modifier_id)`). | db-architect.md Regla 1, reliability-tester.md |
| 9 | Billing | Cuenta y Cobro de Mesas | Facturación y cierre de cuenta (`bills`, `bill_orders`) para control de caja, agregando subtotales, propina, impuestos y método de pago (`CASH`, `CARD`, etc.). | `table_id`, lista de órdenes, método de pago | Registro de cuenta, mesa pasa a `CLOSED` | Rechazo si las órdenes no corresponden a la mesa o ya están facturadas. | ORIGINAL_REQUEST.md R1 Caja, AC Flujo |
| 10 | Realtime | Notificaciones CDC / Triggers PostgreSQL | Triggers de base de datos que ejecutan `NOTIFY` en canales dedicados al insertar/actualizar órdenes, emitiendo payload JSON estructurado. | Inserción o actualización en `orders` / `order_items` | Notificación emitida en canal `restaurant_events` | Si falla el trigger, aborta transacción (integridad estricta). | ORIGINAL_REQUEST.md R2, kds-engineer.md |
| 11 | Realtime | Sincronización WebSockets / SSE | Capa de transporte en Next.js (Server-Sent Events o WebSocket) que expone eventos en milisegundos hacia KDS, Tablet y Caja. | Conexión cliente a endpoint `/api/realtime` | Flujo continuo de eventos JSON con reconexión automática | Manejo de desconexión mediante heartbeat y reconexión en cliente. | ORIGINAL_REQUEST.md R2, kds-engineer.md |
| 12 | Contracts | Tipos TypeScript Sincronizados al 100% | Contratos TypeScript compartidos que modelan estrictamente las entidades de base de datos, DTOs de entrada y eventos en tiempo real. | N/A (código estático) | Interfaces exportadas en `@/types/*` | Error de compilación en build time si el frontend no respeta el esquema relacional. | db-architect.md Regla 4, ORIGINAL_REQUEST.md R2 |

---

## 3. Edge Cases y Manejo de Concurrencia

| # | Feature | Input / Escenario | Comportamiento Observado / Especificado |
|---|---------|-------------------|------------------------------------------|
| 1 | Idempotencia | Ráfaga de 5 clics idénticos con el mismo `idempotency_key` en 50ms | La primera petición adquiere la fila e inserta la comanda en una transacción ACID. Las siguientes 4 peticiones chocan con la restricción `UNIQUE (idempotency_key)` y retornan HTTP 200 con la orden ya existente y flag `is_duplicate: true`, sin insertar ítems duplicados ni disparar eventos duplicados a cocina. |
| 2 | Modificadores | Intento de enviar personalización como string ("sin cebolla") en un campo de notas | El schema rechaza el payload; la API valida que no existan campos de texto libre para modificaciones. Se exige arreglo de `modifier_ids: UUID[]` válidos en `modifiers`. |
| 3 | Modificadores | Selección fuera de cardinalidad (ej. 2 términos de carne en un grupo con `max_selection: 1`) | La validación del backend compara la cantidad de modificadores seleccionados por grupo contra `min_selection` y `max_selection`, arrojando HTTP 400 Bad Request con detalle del grupo violado. |
| 4 | Modificadores | Modificador no asignado al producto pedido | El backend verifica que el `modifier_id` pertenezca a un grupo activo asociado al `product_id` a través de `product_modifier_groups`. Rechazo HTTP 422 Unprocessable Entity. |
| 5 | Concurrencia KDS | Cocinero A y Cocinero B cambian el estado de la misma comanda a la vez | Actualización con bloqueo optimista o condicional (`UPDATE orders SET status = $new WHERE id = $id AND status = $expected`). Si no coincide, retorna el estado actual sin corromper el flujo. |
| 6 | Desconexión de Red | El cliente pierde conexión inmediatamente después de enviar la orden | Gracias al `idempotency_key` persistido en `localStorage` por la tablet, al recuperar red y reintentar, el backend devuelve la comanda creada previamente sin duplicar el cobro ni la preparación. |
| 7 | Facturación | Intento de cobrar una mesa sin órdenes o con órdenes en estado `CANCELLED` | El backend valida que existan órdenes activas (`PENDING`, `IN_PREP`, `READY`, `SERVED`) asociadas a la mesa antes de generar el registro en `bills`. |

---

## 4. Diseño del Esquema Relacional SQL (DDL PostgreSQL 16)

A continuación se detalla el esquema DDL canónico. Cumple estrictamente con la Regla 1 (cero texto libre para modificadores) y Regla 2 (clave de idempotencia única):

```sql
-- ============================================================================
-- EXTENSIONES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABLA: tables (Mesas del Restaurante)
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number INT NOT NULL UNIQUE,
    capacity INT NOT NULL DEFAULT 4 CHECK (capacity > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' 
        CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'BILL_REQUESTED', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. TABLA: categories (Categorías de Menú)
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. TABLA: products (Platos y Bebidas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2) NOT NULL CHECK (base_price >= 0),
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. TABLA: modifier_groups (Grupos de Modificadores Relacionales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    min_selection INT NOT NULL DEFAULT 0 CHECK (min_selection >= 0),
    max_selection INT NOT NULL DEFAULT 1 CHECK (max_selection >= min_selection),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. TABLA: product_modifier_groups (Asociación N:M Producto <-> Grupo)
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_modifier_groups (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    display_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, modifier_group_id)
);

-- ============================================================================
-- 6. TABLA: modifiers (Opciones Atómicas de Modificador)
-- ============================================================================
CREATE TABLE IF NOT EXISTS modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price_delta DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (price_delta >= 0),
    action_type VARCHAR(20) NOT NULL 
        CHECK (action_type IN ('NO', 'EXTRA', 'OPTION', 'SUBSTITUTE')),
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. TABLA: orders (Comandas / Pedidos con Idempotencia)
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
    idempotency_key UUID NOT NULL UNIQUE, -- << REGLA 2: OBLIGATORIO Y ÚNICO
    order_number SERIAL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'IN_PREP', 'READY', 'SERVED', 'CANCELLED')),
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. TABLA: order_items (Líneas de la Comanda)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'IN_PREP', 'READY', 'SERVED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. TABLA: order_item_modifiers (Modificadores Seleccionados en Ítem)
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_id UUID NOT NULL REFERENCES modifiers(id) ON DELETE RESTRICT,
    unit_price_delta DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price_delta >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (order_item_id, modifier_id)
);

-- ============================================================================
-- 10. TABLA: bills & bill_orders (Caja y Facturación de Mesas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    tax DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (tax >= 0),
    tip DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (tip >= 0),
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'PAID', 'CANCELLED')),
    payment_method VARCHAR(50) 
        CHECK (payment_method IN ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'SPLIT')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_orders (
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    PRIMARY KEY (bill_id, order_id)
);

-- ============================================================================
-- ÍNDICES PARA ALTO RENDIMIENTO
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_item_id ON order_item_modifiers(order_item_id);
CREATE INDEX IF NOT EXISTS idx_modifiers_group_id ON modifiers(modifier_group_id);
CREATE INDEX IF NOT EXISTS idx_bills_table_id ON bills(table_id);
```

---

## 5. Mecanismo de Idempotencia y Transaccionalidad

Para cumplir a rajatabla el requisito de fiabilidad ante redes inestables de restaurante y ráfagas de clics repetidos:

### 5.1 Flujo Transaccional en Backend
1. **Recepción del Payload:** El cliente genera un UUID v4 antes de enviar la comanda (`idempotency_key: "f47ac10b-58cc-4372-a567-0e02b2c3d479"`).
2. **Inicio de Transacción:**
   ```sql
   BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
   ```
3. **Consulta o Inserción Atómica:**
   ```sql
   -- Intento de inserción con cláusula ON CONFLICT
   INSERT INTO orders (id, table_id, idempotency_key, status, total_amount)
   VALUES ($order_id, $table_id, $idempotency_key, 'PENDING', $total_amount)
   ON CONFLICT (idempotency_key) DO NOTHING
   RETURNING id;
   ```
4. **Verificación del Resultado:**
   - Si la inserción retorna una fila: Se insertan los `order_items` y sus correspondientes `order_item_modifiers` dentro de la misma transacción. Se actualiza el estado de la mesa a `OCCUPIED`. Se hace `COMMIT`. Se emite evento en tiempo real `ORDER_CREATED`. Se responde `HTTP 201 Created`.
   - Si la inserción retorna 0 filas (conflicto por `idempotency_key` preexistente): Se hace `ROLLBACK` (o se descarta la inserción adicional) y se consulta la orden original con sus ítems:
     ```sql
     SELECT * FROM orders WHERE idempotency_key = $idempotency_key;
     ```
     Se responde `HTTP 200 OK` con la orden original, cabecera HTTP `X-Idempotent-Replay: true` y sin disparar alertas auditivas repetidas a la cocina.

---

## 6. Arquitectura de Sincronización en Tiempo Real

El sistema exige sincronización reactiva hacia KDS (`/cocina`), tablet (`/mesa/[id]`) y caja (`/caja`).

### 6.1 Mecanismo de Transporte: Server-Sent Events (SSE) con Fallback a WebSocket
Para la arquitectura web Next.js en navegador moderno, **Server-Sent Events (SSE)** ofrece las siguientes ventajas operativas:
- Protocolo unidireccional HTTP nativo (`text/event-stream`), sin necesidad de brokers pesados ni puertos adicionales.
- Reconexión automática nativa gestionada por la API `EventSource` del navegador.
- Cero dependencias binarias externas en Node.js.

### 6.2 PostgreSQL LISTEN/NOTIFY Trigger
Para arquitecturas donde PostgreSQL emite eventos directos ante cambios en la BD:

```sql
CREATE OR REPLACE FUNCTION notify_order_change() RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        payload = json_build_object(
            'event', 'ORDER_CREATED',
            'order_id', NEW.id,
            'table_id', NEW.table_id,
            'status', NEW.status,
            'total_amount', NEW.total_amount,
            'created_at', NEW.created_at
        );
    ELSIF (TG_OP = 'UPDATE') THEN
        payload = json_build_object(
            'event', 'ORDER_STATUS_CHANGED',
            'order_id', NEW.id,
            'table_id', NEW.table_id,
            'previous_status', OLD.status,
            'status', NEW.status,
            'updated_at', NEW.updated_at
        );
    END IF;

    PERFORM pg_notify('restaurant_events', payload::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_notify ON orders;
CREATE TRIGGER trg_order_notify
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION notify_order_change();
```

En el backend Next.js:
- Un hub de eventos en memoria (`EventEmitter` / canal `EventEmitter2`) o conexión `pg.Client.on('notification')` canaliza el evento y lo retransmite de forma reactiva al stream SSE de cada cliente conectado.

---

## 7. Contratos TypeScript (Sincronización 100%)

Los contratos TypeScript compartidos se ubican canónicamente en `src/types/database.ts` y `src/types/api.ts`:

```typescript
// ============================================================================
// ENUMS Y TIPOS BASE
// ============================================================================

export type OrderStatus = 'PENDING' | 'IN_PREP' | 'READY' | 'SERVED' | 'CANCELLED';
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'CLOSED';
export type ModifierActionType = 'NO' | 'EXTRA' | 'OPTION' | 'SUBSTITUTE';
export type BillStatus = 'OPEN' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'TRANSFER' | 'SPLIT';

// ============================================================================
// MODELOS DE BASE DE DATOS (ENTIDADES)
// ============================================================================

export interface RestaurantTable {
  id: string; // UUID
  table_number: number;
  capacity: number;
  status: TableStatus;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string; // UUID
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string; // UUID
  category_id: string;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModifierGroup {
  id: string; // UUID
  name: string;
  min_selection: number;
  max_selection: number;
  created_at: string;
}

export interface Modifier {
  id: string; // UUID
  modifier_group_id: string;
  name: string;
  price_delta: number;
  action_type: ModifierActionType;
  is_available: boolean;
  display_order: number;
  created_at: string;
}

export interface ProductModifierGroup {
  product_id: string;
  modifier_group_id: string;
  display_order: number;
}

export interface Order {
  id: string; // UUID
  table_id: string;
  idempotency_key: string; // UUID
  order_number: number;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string; // UUID
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  status: OrderStatus;
  created_at: string;
}

export interface OrderItemModifier {
  id: string; // UUID
  order_item_id: string;
  modifier_id: string;
  unit_price_delta: number;
  created_at: string;
}

export interface Bill {
  id: string; // UUID
  table_id: string;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  status: BillStatus;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  created_at: string;
}

// ============================================================================
// DTOs Y CONTRATOS DE API
// ============================================================================

export interface CreateOrderItemInput {
  product_id: string; // UUID
  quantity: number;
  modifier_ids: string[]; // UUIDs estrictamente relacionales
}

export interface CreateOrderRequest {
  idempotency_key: string; // UUID generado en tablet
  table_id: string; // UUID de mesa
  items: CreateOrderItemInput[];
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

export interface ProcessPaymentRequest {
  table_id: string;
  payment_method: PaymentMethod;
  tip_amount?: number;
}

// ============================================================================
// CONTRATOS ENRIQUECIDOS PARA FRONTEND (KDS / TABLET / CAJA)
// ============================================================================

export interface OrderItemWithDetails {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  status: OrderStatus;
  modifiers: {
    modifier_id: string;
    name: string;
    price_delta: number;
    action_type: ModifierActionType;
  }[];
}

export interface KDSOrderCard {
  id: string;
  order_number: number;
  table_number: number;
  table_id: string;
  status: OrderStatus;
  created_at: string;
  elapsed_minutes: number;
  items: OrderItemWithDetails[];
}

// ============================================================================
// EVENTOS EN TIEMPO REAL (DISCRIMINATED UNIONS)
// ============================================================================

export type RealtimeEvent =
  | { type: 'ORDER_CREATED'; payload: KDSOrderCard }
  | { type: 'ORDER_STATUS_CHANGED'; payload: { order_id: string; status: OrderStatus; updated_at: string } }
  | { type: 'TABLE_STATUS_CHANGED'; payload: { table_id: string; status: TableStatus } }
  | { type: 'BILL_UPDATED'; payload: { bill_id: string; table_id: string; status: BillStatus } };
```

---

## 8. Estrategia de Migración y Semillas (Seed Data)

### 8.1 Menú Realista Bogotano / Restaurante
El seed incluirá:
- **8 Mesas:** Mesas 1 a 8 con capacidades de 2, 4 y 6 personas.
- **Categorías:**
  1. *Hamburguesas Artesanales*
  2. *Pizzas al Horno*
  3. *Acompañamientos y Entradas*
  4. *Bebidas y Cervezas*
- **Grupos y Modificadores Relacionales:**
  - *Término de la Carne* (min: 1, max: 1): Término Azul, Término Medio, Tres Cuartos, Bien Asado.
  - *Remover Ingredientes* (min: 0, max: 5): Sin Cebolla, Sin Tomate, Sin Pepinillos, Sin Lechuga, Sin Salsa de la Casa.
  - *Adiciones Extra* (min: 0, max: 4): Extra Queso Cheddar (+$3.500), Extra Tocineta Ahumada (+$4.500), Huevo Frito (+$2.000), Tapa de Guacamole (+$3.000).
  - *Tipo de Masa Pizza* (min: 1, max: 1): Masa Tradicional, Masa Delgada, Borde de Queso (+$5.000).
- **Platos Semilla:**
  - Hamburguesa Clásica Bogotana ($24.000)
  - Hamburguesa Doble Carne y Queso ($32.000)
  - Pizza Margarita ($28.000)
  - Pizza Pepperoni & Miel Picante ($34.000)
  - Papas Rústicas con Romero ($12.000)
  - Cerveza Artesanal IPA ($14.000)
  - Limonada de Coco Natural ($10.000)

### 8.2 Estrategia de Ejecución de Migraciones
1. Archivo `scripts/migrations/001_initial_schema.sql` y `scripts/migrations/002_seed_menu.sql`.
2. Script de migración en Node/TypeScript (`npm run db:migrate` y `npm run db:seed`) que detecta automáticamente si el entorno está usando PostgreSQL estándar (Docker/Supabase) o `@electric-sql/pglite` embebido, aplicando el DDL y los datos iniciales de forma idempotente.
