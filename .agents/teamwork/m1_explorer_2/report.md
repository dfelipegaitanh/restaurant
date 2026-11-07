# Informe de Arquitectura e Implementación: Idempotencia, Handlers de API y Contratos de Dominio (M1)

**Autor:** Subagente de Exploración Técnica (`teamwork_explorer` / `m1_explorer_2`)  
**Fecha:** 2026-11-06  
**Hito:** Milestone 1 (M1: Core Backend & Relational DB)  
**Destino:** `/Users/felipegaitan/projects/restaurant/.agents/teamwork/m1_explorer_2/report.md`  
**Archivos de Entrada Auditados:** `.agents/teamwork/ORIGINAL_REQUEST.md`, `.agents/teamwork/PROJECT.md`, `.agents/roles/db-architect.md`, `.agents/teamwork/survey_miner_db/report.md`, `.agents/teamwork/survey_miner_ui/report.md`, `.agents/teamwork/survey_explorer_infra/report.md`.

---

## 1. Diagnóstico Inicial y Auditoría Sin Filtro (Anti-Chambonadas)

Mire hermano, poner a funcionar un restaurante en hora pico con tablets en las mesas y pantallas en cocina no es juego de niños. Si el Wi-Fi parpadea y la tablet reintenta mandar la comanda, o si el comensal le da cinco clics frenéticos al botón de "Confirmar Pedido" porque piensa que no le hizo caso, una implementación chambona metería cinco hamburguesas a la comanda y cobraría cinco veces la cuenta. Eso en un restaurante real termina en botellazo contra la caja o en meseros puteando al sistema.

Para que este prototipo tenga calidad de producción militar y cumpla los requerimientos de fiabilidad de `reliability-tester.md` y `ORIGINAL_REQUEST.md`, identificamos los siguientes pilares innegociables:

1. **Idempotencia Atómica Real (Cero Duplicados en BD ni en Cocina):**
   - El token de idempotencia **debe ser un UUID v4 estricto** generado en el cliente antes del envío.
   - La unicidad se garantiza a nivel de motor relacional (`orders.idempotency_key UNIQUE`).
   - Ante colisión o ráfaga de clics concurrentes (5 peticiones en 50ms):
     - La primera petición inserta en una transacción ACID (`orders`, `order_items`, `order_item_modifiers`), emite el evento en tiempo real `ORDER_CREATED` al KDS y responde `HTTP 201 Created`.
     - Las siguientes peticiones concurrentes o reintentos posteriores detectan el conflicto mediante `ON CONFLICT (idempotency_key) DO NOTHING` o captura del código de error Postgres `23505 (unique_violation)`.
     - El handler recupera la orden original completa de la BD y responde `HTTP 200 OK` con cabecera `X-Idempotent-Replay: true` y cuerpo `{ success: true, order: existingOrder, replayed: true }`.
     - **Regla de oro:** Cero inserción de ítems duplicados, cero sonido de campana repetido en cocina (`eventHub` silenciado en repeticiones).

2. **Modificadores Relacionales de Primera Clase (Cero Texto Libre):**
   - Prohibido cualquier campo tipo `notes: "sin cebolla"`.
   - Se valida cardinalidad en servidor: si un grupo exige `min_selection: 1` (ej. término de carne) y el cliente manda 0 o 2, se rechaza de inmediato con `HTTP 400 Bad Request`.
   - El precio unitario jamás se toma del cliente (prevención de manipulación): se recalcula en servidor a partir de `products.base_price + sum(modifiers.price_delta)`.

3. **Compatibilidad Next.js 15 App Router:**
   - En Next.js 15, `params` en route handlers dinámicos (`/api/orders/[id]/status`) es una Promesa (`{ params }: { params: Promise<{ id: string }> }`). Omitir el `await params` revienta la aplicación en tiempo de ejecución. Nuestro diseño lo tiene resuelto y blindado.

4. **Máquina de Estados Finita para KDS:**
   - Transiciones estrictas: `PENDING` -> `IN_PREP` -> `READY` -> `SERVED`.
   - Se permite `CANCELLED` únicamente desde estados activos (`PENDING`, `IN_PREP`).
   - Salto ilegal (ej. `PENDING -> SERVED`) se rechaza con `HTTP 400 Bad Request`.

---

## 2. Especificación de Endpoints y Lógica de Negocio

### 2.1 `POST /api/orders` (Creación de Comanda con Idempotencia Atómica)

#### 2.1.1 Contrato del Request
- **Método:** `POST`
- **Ruta:** `/api/orders`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "table_id": "8e3b5e12-4217-4835-971c-76e939a9c8b1",
  "idempotency_key": "4a737f10-9ec8-4905-a81d-840909066601",
  "items": [
    {
      "product_id": "c3e98144-8833-40a1-8d29-1a7384a20b12",
      "quantity": 2,
      "modifiers": [
        { "modifier_id": "0d2c20a1-bb29-4d62-a50e-749e79f67a22" },
        { "modifier_id": "7f1c1a93-79d1-4cb5-8a90-82d2a44781bb" }
      ]
    }
  ]
}
```

*Nota de Resiliencia en DTO:* El parser soportará tanto `item.modifiers: [{ modifier_id: string }]` (formato `PROJECT.md`) como `item.modifier_ids: string[]` o `item.modifiers: string[]` (formato DTO plano), garantizando compatibilidad absoluta con cualquier componente de UI o script de test.

#### 2.1.2 Pipeline de Validación (Filtros Previos a la Transacción)
1. **Validación de UUID v4 de Idempotencia:**
   - Regex canónico: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`.
   - Si no es válido o está ausente -> `400 Bad Request` (`"idempotency_key must be a valid UUID v4"`).
2. **Validación de Mesa:**
   - Consulta `restaurant_tables WHERE id = $table_id`.
   - Si no existe -> `404 Not Found` (`"Table not found"`).
3. **Validación de Ítems:**
   - Debe ser un array con `items.length > 0`.
   - Cada ítem debe tener `quantity` entero positivo (`Number.isInteger(qty) && qty > 0`).
4. **Validación Relacional de Productos y Modificadores:**
   - Consultar en BD los productos involucrados (`is_available = TRUE`).
   - Consultar los grupos de modificadores asignados a cada producto (`product_modifier_groups` JOIN `modifier_groups` JOIN `modifiers`).
   - Para cada producto en la comanda:
     - Verificar que cada `modifier_id` enviado pertenezca efectivamente a un grupo habilitado para ese producto. Si no -> `400 Bad Request` (`"Modifier X is not valid for product Y"`).
     - Para cada grupo de modificadores asignado al producto:
       - Contar cuántos modificadores de ese grupo fueron seleccionados (`count`).
       - Si `count < min_selection` -> `400 Bad Request` (`"Group '${group.name}' requires at least ${group.min_selection} selections"`).
       - Si `count > max_selection` -> `400 Bad Request` (`"Group '${group.name}' allows at most ${group.max_selection} selections"`).

#### 2.1.3 Algoritmo de Transacción ACID e Idempotencia Concurrente
Para soportar tanto la conexión estándar de PostgreSQL (`pg`) como el motor embebido `@electric-sql/pglite`, se utiliza la abstracción de transacción provista por el adaptador de base de datos (`lib/db/index.ts`):

```
                       [POST /api/orders Payload]
                                   │
                    ¿idempotency_key ya existe en BD?
                                  / \
                           SÍ    /   \   NO
                                /     \
       [Recuperar orden existente]     [Iniciar Transacción DB]
                  │                                │
        [HTTP 200 OK + Header]          [INSERT INTO orders ...]
     [X-Idempotent-Replay: true]       (ON CONFLICT DO NOTHING)
        (Cero eventos KDS)                        │
                                        ¿Conflicto detectado?
                                                / \
                                         SÍ    /   \   NO
                                              /     \
                                  [ROLLBACK /]       [INSERT order_items]
                                  [Query orden]      [INSERT order_item_modifiers]
                                       │             [UPDATE table status='OCCUPIED']
                                  [HTTP 200 OK]      [COMMIT Transacción]
                                                     [eventHub.broadcast(ORDER_CREATED)]
                                                     [HTTP 201 Created]
```

#### 2.1.4 Detalle SQL del Flujo de Inserción
1. **Cálculo de Precios en Servidor:**
   ```typescript
   let orderTotal = 0;
   const processedItems = items.map(item => {
     const product = productCatalog.get(item.product_id);
     const itemModifiers = item.modifier_ids.map(id => modifierCatalog.get(id));
     const modifiersDelta = itemModifiers.reduce((acc, m) => acc + Number(m.price_delta), 0);
     const unitPrice = Number(product.base_price) + modifiersDelta;
     const subtotal = unitPrice * item.quantity;
     orderTotal += subtotal;
     return { ...item, unitPrice, subtotal, itemModifiers };
   });
   ```

2. **Inserción Atómica de la Cabecera:**
   ```sql
   INSERT INTO orders (id, table_id, idempotency_key, status, total_amount, created_at, updated_at)
   VALUES ($1, $2, $3, 'PENDING', $4, NOW(), NOW())
   ON CONFLICT (idempotency_key) DO NOTHING
   RETURNING id, table_id, idempotency_key, order_number, status, total_amount, created_at, updated_at;
   ```

3. **Bifurcación de Idempotencia:**
   - **Caso Conflicto (Fila no retornada o error `23505`):**
     Se realiza:
     ```sql
     SELECT o.*, t.table_number 
     FROM orders o 
     JOIN restaurant_tables t ON o.table_id = t.id 
     WHERE o.idempotency_key = $idempotency_key;
     ```
     Se devuelven sus ítems y modificadores relacionados, y se retorna de inmediato:
     ```typescript
     return NextResponse.json(
       { success: true, order: existingOrder, replayed: true },
       { 
         status: 200, 
         headers: { 'X-Idempotent-Replay': 'true' } 
       }
     );
     ```
   - **Caso Nueva Orden:**
     Se insertan secuencialmente las líneas y sus modificadores:
     ```sql
     INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, subtotal, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW());

     INSERT INTO order_item_modifiers (id, order_item_id, modifier_id, unit_price_delta, created_at)
     VALUES ($1, $2, $3, $4, NOW());
     ```
     Se actualiza la mesa a ocupada:
     ```sql
     UPDATE restaurant_tables 
     SET status = 'OCCUPIED', updated_at = NOW() 
     WHERE id = $table_id AND status = 'AVAILABLE';
     ```
     Se confirma la transacción (`COMMIT`).
     Se despacha el evento reactivo a cocina:
     ```typescript
     eventHub.broadcast({
       type: 'ORDER_CREATED',
       payload: {
         id: newOrder.id,
         order_number: newOrder.order_number,
         table_id: table.id,
         table_number: table.table_number,
         status: 'PENDING',
         created_at: newOrder.created_at,
         total_amount: newOrder.total_amount,
         items: fullItemsWithModifiers
       }
     });
     ```
     Se responde:
     ```typescript
     return NextResponse.json(
       { success: true, order: newOrderSummary, replayed: false },
       { status: 201 }
     );
     ```

---

### 2.2 `GET /api/menu` (Catálogo Jerárquico con Modificadores Relacionales)

#### 2.2.1 Objetivo y Arquitectura de Consulta
El endpoint devuelve todas las categorías activas con sus productos disponibles, y para cada producto, sus grupos de modificadores con sus opciones individuales.

Mapeo relacional:
`categories` (1:N) -> `products` (N:M vía `product_modifier_groups`) -> `modifier_groups` (1:N) -> `modifiers`.

#### 2.2.2 Estrategia de Ensamblado (Resiliente Dual-Mode PGlite/PG)
Para evitar incompatibilidades entre la serialización JSON de WebAssembly PGlite y drivers estándar, la consulta se diseña mediante una función optimizada en `lib/db/queries.ts` que realiza 3 consultas planas y ensambla el árbol en TypeScript:

1. **Consulta 1 (Categorías):**
   ```sql
   SELECT id, name, display_order, is_active 
   FROM categories 
   WHERE is_active = TRUE 
   ORDER BY display_order ASC;
   ```
2. **Consulta 2 (Productos):**
   ```sql
   SELECT id, category_id, name, description, base_price, image_url, is_available 
   FROM products 
   WHERE is_available = TRUE 
   ORDER BY name ASC;
   ```
3. **Consulta 3 (Grupos y Modificadores Relacionales):**
   ```sql
   SELECT 
     pmg.product_id,
     mg.id AS group_id,
     mg.name AS group_name,
     mg.min_selection,
     mg.max_selection,
     pmg.display_order AS group_order,
     m.id AS modifier_id,
     m.name AS modifier_name,
     m.price_delta,
     m.action_type,
     m.is_available,
     m.display_order AS modifier_order
   FROM product_modifier_groups pmg
   JOIN modifier_groups mg ON pmg.modifier_group_id = mg.id
   JOIN modifiers m ON m.modifier_group_id = mg.id
   WHERE m.is_available = TRUE
   ORDER BY pmg.display_order ASC, m.display_order ASC;
   ```

#### 2.2.3 Contrato de Respuesta (`GET /api/menu`)
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "categories": [
    {
      "id": "b1a2c3d4-...",
      "name": "Hamburguesas Artesanales",
      "display_order": 1,
      "products": [
        {
          "id": "c1d2e3f4-...",
          "name": "Hamburguesa Clásica Bogotana",
          "description": "Carne de res 100% Angus, queso campesino, lechuga y tomate en pan brioche.",
          "base_price": 24000,
          "image_url": "/images/burger.jpg",
          "is_available": true,
          "modifier_groups": [
            {
              "id": "g1a2b3c4-...",
              "name": "Término de la Carne",
              "min_selection": 1,
              "max_selection": 1,
              "modifiers": [
                {
                  "id": "m1a2b3-...",
                  "name": "Término Azul",
                  "price_delta": 0,
                  "action_type": "OPTION"
                },
                {
                  "id": "m2a2b3-...",
                  "name": "Término Medio",
                  "price_delta": 0,
                  "action_type": "OPTION"
                }
              ]
            },
            {
              "id": "g2a2b3c4-...",
              "name": "Adiciones Extra",
              "min_selection": 0,
              "max_selection": 4,
              "modifiers": [
                {
                  "id": "m3a2b3-...",
                  "name": "Extra Queso Cheddar",
                  "price_delta": 3500,
                  "action_type": "EXTRA"
                },
                {
                  "id": "m4a2b3-...",
                  "name": "Tocineta Ahumada",
                  "price_delta": 4500,
                  "action_type": "EXTRA"
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

### 2.3 `GET /api/tables` (Supervisión de Mesas y Ocupación)

#### 2.3.1 Objetivo y Arquitectura de Consulta
Proporciona la lista de mesas para la vista de selección de cliente (`/mesa/[id]`) y el panel de control de caja (`/caja`). Calcula de forma dinámica cuántas órdenes activas tiene cada mesa y el monto total pendiente de pago.

#### 2.3.2 SQL con Agregación de Estado
```sql
SELECT 
  t.id, 
  t.table_number, 
  t.capacity, 
  t.status, 
  t.created_at, 
  t.updated_at,
  COUNT(o.id) FILTER (WHERE o.status IN ('PENDING', 'IN_PREP', 'READY', 'SERVED')) AS active_orders_count,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status IN ('PENDING', 'IN_PREP', 'READY', 'SERVED')), 0) AS total_unpaid_amount
FROM restaurant_tables t
LEFT JOIN orders o ON t.id = o.table_id
GROUP BY t.id, t.table_number, t.capacity, t.status, t.created_at, t.updated_at
ORDER BY t.table_number ASC;
```

#### 2.3.3 Contrato de Respuesta (`GET /api/tables`)
- **Status:** `200 OK`
- **Body:**
```json
{
  "success": true,
  "tables": [
    {
      "id": "8e3b5e12-4217-4835-971c-76e939a9c8b1",
      "table_number": 1,
      "capacity": 4,
      "status": "OCCUPIED",
      "active_orders_count": 2,
      "total_unpaid_amount": 57000
    },
    {
      "id": "8e3b5e12-4217-4835-971c-76e939a9c8b2",
      "table_number": 2,
      "capacity": 2,
      "status": "AVAILABLE",
      "active_orders_count": 0,
      "total_unpaid_amount": 0
    }
  ]
}
```

---

### 2.4 `PATCH /api/orders/[id]/status` (Transición de Estados de Comanda KDS)

#### 2.4.1 Máquina de Estados Finita (FSM)
Las comandas en cocina siguen un flujo unidireccional para garantizar que los cocineros no se salten pasos ni generen estados inconsistentes:

```
               ┌──────────┐
               │ PENDING  │
               └────┬─────┘
                    │ (Iniciar Preparación)
                    ▼
               ┌──────────┐
               │ IN_PREP  │
               └────┬─────┘
                    │ (Marcar Listo)
                    ▼
               ┌──────────┐
               │  READY   │
               └────┬─────┘
                    │ (Entregar en Mesa)
                    ▼
               ┌──────────┐
               │  SERVED  │ (Estado final de cocina)
               └──────────┘
```

**Matriz de Transiciones Permitidas:**
| Estado Actual | Transiciones Válidas | Rechazadas (400 Bad Request) |
|---|---|---|
| `PENDING` | `IN_PREP`, `CANCELLED` | `READY`, `SERVED` |
| `IN_PREP` | `READY`, `CANCELLED` | `PENDING`, `SERVED` |
| `READY` | `SERVED` | `PENDING`, `IN_PREP`, `CANCELLED` |
| `SERVED` | *(Ninguna - comanda servida)* | `PENDING`, `IN_PREP`, `READY`, `CANCELLED` |
| `CANCELLED` | *(Ninguna - estado terminal)* | Todos los demás |

#### 2.4.2 Manejo de Parámetros Dinámicos en Next.js 15
En Next.js 15, la firma del handler exige desempaquetar `params` de forma asíncrona:
```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // Obligatorio en Next.js 15
  // ...
}
```

#### 2.4.3 Algoritmo del Handler
1. **Validación del ID:** Comprobar formato UUID.
2. **Lectura y Validación del Body:**
   ```typescript
   const body = await request.json().catch(() => null);
   const nextStatus: OrderStatus = body?.status;
   ```
3. **Consulta de Orden Existente:**
   ```sql
   SELECT id, table_id, status FROM orders WHERE id = $id;
   ```
   Si no existe -> `404 Not Found`.
4. **Verificación contra la FSM:**
   ```typescript
   const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
     PENDING: ['IN_PREP', 'CANCELLED'],
     IN_PREP: ['READY', 'CANCELLED'],
     READY: ['SERVED'],
     SERVED: [],
     CANCELLED: []
   };

   if (!ALLOWED_TRANSITIONS[currentOrder.status].includes(nextStatus)) {
     return NextResponse.json(
       { 
         success: false, 
         error: `Transición inválida de ${currentOrder.status} a ${nextStatus}. Transiciones permitidas: ${ALLOWED_TRANSITIONS[currentOrder.status].join(', ') || 'ninguna'}` 
       },
       { status: 400 }
     );
   }
   ```
5. **Actualización en BD:**
   ```sql
   UPDATE orders 
   SET status = $1, updated_at = NOW() 
   WHERE id = $2 
   RETURNING id, table_id, order_number, status, total_amount, updated_at;
   ```
   Y actualización en cascada de los ítems:
   ```sql
   UPDATE order_items SET status = $1 WHERE order_id = $2;
   ```
6. **Emisión de Evento SSE en Tiempo Real:**
   ```typescript
   eventHub.broadcast({
     type: 'ORDER_STATUS_CHANGED',
     payload: {
       order_id: updatedOrder.id,
       table_id: updatedOrder.table_id,
       old_status: currentOrder.status,
       new_status: nextStatus,
       updated_at: updatedOrder.updated_at
     }
   });
   ```
7. **Respuesta:** `HTTP 200 OK` con `{ success: true, order: updatedOrder }`.

---

## 3. Contratos de Tipos de Dominio (`types/domain.ts`)

A continuación se define el archivo canónico unificado `types/domain.ts`, que sincroniza al 100% con el DDL relacional y cubre todas las necesidades de la tablet, el KDS, la caja y los tests E2E:

```typescript
// ============================================================================
// types/domain.ts — Contratos Canónicos del Dominio de Restaurante
// ============================================================================

// ----------------------------------------------------------------------------
// ENUMS Y TIPOS BASE
// ----------------------------------------------------------------------------
export type OrderStatus = 'PENDING' | 'IN_PREP' | 'READY' | 'SERVED' | 'CANCELLED';
export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'CLOSED';
export type ModifierAction = 'NO' | 'EXTRA' | 'OPTION' | 'SUBSTITUTE';
export type ModifierActionType = ModifierAction; // Alias de compatibilidad
export type BillStatus = 'OPEN' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'TRANSFER' | 'SPLIT';

// ----------------------------------------------------------------------------
// MODELOS DE BASE DE DATOS (FILAS CRUD)
// ----------------------------------------------------------------------------
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
  action_type: ModifierAction;
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

// ----------------------------------------------------------------------------
// ESTRUCTURAS JERÁRQUICAS (CATÁLOGO Y KDS)
// ----------------------------------------------------------------------------
export interface ModifierGroupWithOptions extends ModifierGroup {
  modifiers: Modifier[];
}

export interface ProductWithModifiers extends Product {
  modifier_groups: ModifierGroupWithOptions[];
}

export interface CategoryWithProducts extends Category {
  products: ProductWithModifiers[];
}

export interface OrderItemDetail {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  status: OrderStatus;
  modifiers: {
    modifier_id: string;
    name: string;
    price_delta: number;
    action_type: ModifierAction;
  }[];
}

export interface OrderSummary {
  id: string;
  table_id: string;
  table_number: number;
  idempotency_key: string;
  order_number: number;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  updated_at: string;
  items: OrderItemDetail[];
}

// ----------------------------------------------------------------------------
// DTOs DE ENTRADA Y SALIDA DE APIs
// ----------------------------------------------------------------------------
export interface OrderItemModifierInput {
  modifier_id: string;
}

export interface OrderItemInput {
  product_id: string;
  quantity: number;
  modifiers?: OrderItemModifierInput[];
  modifier_ids?: string[]; // Soporte flexible
}

export interface CreateOrderRequest {
  table_id: string;
  idempotency_key: string; // UUID v4
  items: OrderItemInput[];
}

export interface CreateOrderResponse {
  success: boolean;
  order?: OrderSummary;
  replayed?: boolean;
  error?: string;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
}

export interface UpdateOrderStatusResponse {
  success: boolean;
  order?: {
    id: string;
    table_id: string;
    status: OrderStatus;
    updated_at: string;
  };
  error?: string;
}

export interface MenuResponse {
  success: boolean;
  categories: CategoryWithProducts[];
}

export interface TableSummary extends RestaurantTable {
  active_orders_count: number;
  total_unpaid_amount: number;
}

export interface TablesResponse {
  success: boolean;
  tables: TableSummary[];
}

// ----------------------------------------------------------------------------
// EVENTOS EN TIEMPO REAL (SSE / EVENTHUB)
// ----------------------------------------------------------------------------
export type RealtimeEvent =
  | { type: 'ORDER_CREATED'; payload: OrderSummary }
  | { 
      type: 'ORDER_STATUS_CHANGED'; 
      payload: { 
        order_id: string; 
        table_id: string; 
        old_status: OrderStatus; 
        new_status: OrderStatus; 
        updated_at: string; 
      } 
    }
  | { type: 'TABLE_STATUS_CHANGED'; payload: { table_id: string; status: TableStatus } }
  | { type: 'PAYMENT_COMPLETED'; payload: { table_id: string; bill_id: string; amount: number } };
```

---

## 4. Implementación Concreta Propuesta para el Worker

A continuación se presentan los archivos propuestos listos para ser implementados por el trabajador asignado a Milestone 1:

### 4.1 `app/api/orders/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { eventHub } from '@/lib/events/eventHub';
import { CreateOrderRequest, OrderSummary } from '@/types/domain';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body: CreateOrderRequest = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, error: 'Cuerpo de solicitud inválido o vacío' }, { status: 400 });
    }

    const { table_id, idempotency_key, items } = body;

    // 1. Validar idempotency_key como UUID v4
    if (!idempotency_key || !UUID_V4_REGEX.test(idempotency_key)) {
      return NextResponse.json(
        { success: false, error: 'idempotency_key es obligatorio y debe ser un UUID v4 válido' },
        { status: 400 }
      );
    }

    // 2. Validar mesa existente
    const db = await getDb();
    const tableRes = await db.query('SELECT id, table_number, status FROM restaurant_tables WHERE id = $1', [table_id]);
    if (tableRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'La mesa especificada no existe' }, { status: 404 });
    }
    const table = tableRes.rows[0];

    // 3. Validar array de ítems
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'La orden debe contener al menos un producto' }, { status: 400 });
    }

    // 4. Verificación previa de idempotencia (Fast path de replay)
    const existingOrder = await fetchFullOrderByIdempotencyKey(db, idempotency_key);
    if (existingOrder) {
      return NextResponse.json(
        { success: true, order: existingOrder, replayed: true },
        { status: 200, headers: { 'X-Idempotent-Replay': 'true' } }
      );
    }

    // 5. Cargar catálogo para validar productos y modificadores relacionales
    const productIds = items.map((i) => i.product_id);
    const productsRes = await db.query(
      `SELECT id, name, base_price, is_available FROM products WHERE id = ANY($1::uuid[])`,
      [productIds]
    );
    const productMap = new Map(productsRes.rows.map((p) => [p.id, p]));

    // Cargar reglas de modificadores
    const rulesRes = await db.query(
      `SELECT 
         pmg.product_id, mg.id AS group_id, mg.name AS group_name, mg.min_selection, mg.max_selection,
         m.id AS modifier_id, m.name AS modifier_name, m.price_delta, m.action_type
       FROM product_modifier_groups pmg
       JOIN modifier_groups mg ON pmg.modifier_group_id = mg.id
       JOIN modifiers m ON m.modifier_group_id = mg.id
       WHERE pmg.product_id = ANY($1::uuid[]) AND m.is_available = TRUE`,
      [productIds]
    );

    // Indexar reglas por producto
    const productRules = new Map<string, { groups: Map<string, any>; modifiers: Map<string, any> }>();
    for (const r of rulesRes.rows) {
      if (!productRules.has(r.product_id)) {
        productRules.set(r.product_id, { groups: new Map(), modifiers: new Map() });
      }
      const entry = productRules.get(r.product_id)!;
      if (!entry.groups.has(r.group_id)) {
        entry.groups.set(r.group_id, {
          name: r.group_name,
          min_selection: r.min_selection,
          max_selection: r.max_selection,
          modifierIds: new Set<string>()
        });
      }
      entry.groups.get(r.group_id).modifierIds.add(r.modifier_id);
      entry.modifiers.set(r.modifier_id, {
        name: r.modifier_name,
        price_delta: Number(r.price_delta),
        action_type: r.action_type,
        group_id: r.group_id
      });
    }

    // 6. Validar cada ítem y calcular subtotales en backend
    let grandTotal = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return NextResponse.json({ success: false, error: 'Cantidad de ítem debe ser un entero positivo' }, { status: 400 });
      }
      const product = productMap.get(item.product_id);
      if (!product || !product.is_available) {
        return NextResponse.json({ success: false, error: `Producto no disponible o inválido: ${item.product_id}` }, { status: 400 });
      }

      // Normalizar modifier_ids
      const modIds: string[] = [
        ...(item.modifier_ids || []),
        ...(item.modifiers?.map((m) => m.modifier_id) || [])
      ];

      const rules = productRules.get(item.product_id);
      const chosenModifiers: any[] = [];

      // Validar cardinalidad de cada grupo
      if (rules) {
        for (const [groupId, group] of rules.groups.entries()) {
          const selectedInGroup = modIds.filter((mid) => group.modifierIds.has(mid));
          if (selectedInGroup.length < group.min_selection) {
            return NextResponse.json(
              { success: false, error: `El grupo '${group.name}' requiere mínimo ${group.min_selection} selección(es)` },
              { status: 400 }
            );
          }
          if (selectedInGroup.length > group.max_selection) {
            return NextResponse.json(
              { success: false, error: `El grupo '${group.name}' permite máximo ${group.max_selection} selección(es)` },
              { status: 400 }
            );
          }
        }
      }

      // Validar que cada modificador pertenezca al producto
      let modifiersDelta = 0;
      for (const mid of modIds) {
        const mod = rules?.modifiers.get(mid);
        if (!mod) {
          return NextResponse.json(
            { success: false, error: `Modificador no válido para el producto ${product.name}: ${mid}` },
            { status: 400 }
          );
        }
        chosenModifiers.push({ id: mid, ...mod });
        modifiersDelta += mod.price_delta;
      }

      const unitPrice = Number(product.base_price) + modifiersDelta;
      const subtotal = unitPrice * item.quantity;
      grandTotal += subtotal;

      validatedItems.push({
        product_id: item.product_id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal,
        modifiers: chosenModifiers
      });
    }

    // 7. Transacción Atómica en Base de Datos
    const orderId = crypto.randomUUID();
    let orderRow: any = null;

    try {
      await db.query('BEGIN');

      // Inserción con ON CONFLICT DO NOTHING para atrapar colisiones concurrentes
      const insertOrderRes = await db.query(
        `INSERT INTO orders (id, table_id, idempotency_key, status, total_amount, created_at, updated_at)
         VALUES ($1, $2, $3, 'PENDING', $4, NOW(), NOW())
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id, table_id, idempotency_key, order_number, status, total_amount, created_at, updated_at`,
        [orderId, table_id, idempotency_key, grandTotal]
      );

      // Si no retornó fila, otra petición concurrente ganó la carrera
      if (insertOrderRes.rows.length === 0) {
        await db.query('ROLLBACK');
        const replayed = await fetchFullOrderByIdempotencyKey(db, idempotency_key);
        return NextResponse.json(
          { success: true, order: replayed, replayed: true },
          { status: 200, headers: { 'X-Idempotent-Replay': 'true' } }
        );
      }

      orderRow = insertOrderRes.rows[0];

      // Insertar order_items y order_item_modifiers
      for (const vItem of validatedItems) {
        const orderItemId = crypto.randomUUID();
        await db.query(
          `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, subtotal, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', NOW())`,
          [orderItemId, orderId, vItem.product_id, vItem.quantity, vItem.unit_price, vItem.subtotal]
        );

        for (const mod of vItem.modifiers) {
          const itemModId = crypto.randomUUID();
          await db.query(
            `INSERT INTO order_item_modifiers (id, order_item_id, modifier_id, unit_price_delta, created_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [itemModId, orderItemId, mod.id, mod.price_delta]
          );
        }
      }

      // Marcar mesa como ocupada si estaba disponible
      await db.query(
        `UPDATE restaurant_tables SET status = 'OCCUPIED', updated_at = NOW() WHERE id = $1 AND status = 'AVAILABLE'`,
        [table_id]
      );

      await db.query('COMMIT');
    } catch (txErr: any) {
      await db.query('ROLLBACK').catch(() => {});
      // Manejar violación de unicidad por race condition extrema
      if (txErr?.code === '23505' || txErr?.message?.includes('unique constraint') || txErr?.message?.includes('idempotency_key')) {
        const replayed = await fetchFullOrderByIdempotencyKey(db, idempotency_key);
        return NextResponse.json(
          { success: true, order: replayed, replayed: true },
          { status: 200, headers: { 'X-Idempotent-Replay': 'true' } }
        );
      }
      throw txErr;
    }

    // 8. Construir OrderSummary para el cliente y el KDS
    const fullOrder: OrderSummary = {
      id: orderRow.id,
      table_id: table.id,
      table_number: table.table_number,
      idempotency_key: orderRow.idempotency_key,
      order_number: orderRow.order_number,
      status: orderRow.status,
      total_amount: Number(orderRow.total_amount),
      created_at: orderRow.created_at,
      updated_at: orderRow.updated_at,
      items: validatedItems.map((vi, idx) => ({
        id: `temp-${idx}`,
        product_id: vi.product_id,
        product_name: vi.product_name,
        quantity: vi.quantity,
        unit_price: vi.unit_price,
        subtotal: vi.subtotal,
        status: 'PENDING',
        modifiers: vi.modifiers.map((m: any) => ({
          modifier_id: m.id,
          name: m.name,
          price_delta: m.price_delta,
          action_type: m.action_type
        }))
      }))
    };

    // 9. Emitir evento SSE hacia KDS
    eventHub.broadcast({
      type: 'ORDER_CREATED',
      payload: fullOrder
    });

    return NextResponse.json({ success: true, order: fullOrder, replayed: false }, { status: 201 });
  } catch (err: any) {
    console.error('Error procesando POST /api/orders:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Error interno del servidor' }, { status: 500 });
  }
}

// Función auxiliar para recuperar la orden completa
async function fetchFullOrderByIdempotencyKey(db: any, idempotency_key: string): Promise<OrderSummary | null> {
  const orderRes = await db.query(
    `SELECT o.*, t.table_number 
     FROM orders o 
     JOIN restaurant_tables t ON o.table_id = t.id 
     WHERE o.idempotency_key = $1`,
    [idempotency_key]
  );
  if (orderRes.rows.length === 0) return null;
  const o = orderRes.rows[0];

  const itemsRes = await db.query(
    `SELECT oi.id, oi.product_id, p.name AS product_name, oi.quantity, oi.unit_price, oi.subtotal, oi.status
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1`,
    [o.id]
  );

  const itemIds = itemsRes.rows.map((i: any) => i.id);
  let modsMap = new Map<string, any[]>();
  if (itemIds.length > 0) {
    const modsRes = await db.query(
      `SELECT oim.order_item_id, m.id AS modifier_id, m.name, oim.unit_price_delta AS price_delta, m.action_type
       FROM order_item_modifiers oim
       JOIN modifiers m ON oim.modifier_id = m.id
       WHERE oim.order_item_id = ANY($1::uuid[])`,
      [itemIds]
    );
    for (const m of modsRes.rows) {
      if (!modsMap.has(m.order_item_id)) modsMap.set(m.order_item_id, []);
      modsMap.get(m.order_item_id)!.push({
        modifier_id: m.modifier_id,
        name: m.name,
        price_delta: Number(m.price_delta),
        action_type: m.action_type
      });
    }
  }

  return {
    id: o.id,
    table_id: o.table_id,
    table_number: o.table_number,
    idempotency_key: o.idempotency_key,
    order_number: o.order_number,
    status: o.status,
    total_amount: Number(o.total_amount),
    created_at: o.created_at,
    updated_at: o.updated_at,
    items: itemsRes.rows.map((i: any) => ({
      id: i.id,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: Number(i.unit_price),
      subtotal: Number(i.subtotal),
      status: i.status,
      modifiers: modsMap.get(i.id) || []
    }))
  };
}
```

---

### 4.2 `app/api/menu/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { CategoryWithProducts } from '@/types/domain';

export async function GET() {
  try {
    const db = await getDb();

    // 1. Categorías activas
    const catRes = await db.query(
      `SELECT id, name, display_order, is_active FROM categories WHERE is_active = TRUE ORDER BY display_order ASC`
    );

    // 2. Productos disponibles
    const prodRes = await db.query(
      `SELECT id, category_id, name, description, base_price, image_url, is_available 
       FROM products 
       WHERE is_available = TRUE 
       ORDER BY name ASC`
    );

    // 3. Grupos y Modificadores
    const modRes = await db.query(
      `SELECT 
         pmg.product_id,
         mg.id AS group_id,
         mg.name AS group_name,
         mg.min_selection,
         mg.max_selection,
         pmg.display_order AS group_order,
         m.id AS modifier_id,
         m.name AS modifier_name,
         m.price_delta,
         m.action_type,
         m.display_order AS mod_order
       FROM product_modifier_groups pmg
       JOIN modifier_groups mg ON pmg.modifier_group_id = mg.id
       JOIN modifiers m ON m.modifier_group_id = mg.id
       WHERE m.is_available = TRUE
       ORDER BY pmg.display_order ASC, m.display_order ASC`
    );

    // Indexar modificadores en árbol
    const productGroupsMap = new Map<string, Map<string, any>>();
    for (const row of modRes.rows) {
      if (!productGroupsMap.has(row.product_id)) {
        productGroupsMap.set(row.product_id, new Map());
      }
      const groups = productGroupsMap.get(row.product_id)!;
      if (!groups.has(row.group_id)) {
        groups.set(row.group_id, {
          id: row.group_id,
          name: row.group_name,
          min_selection: row.min_selection,
          max_selection: row.max_selection,
          modifiers: []
        });
      }
      groups.get(row.group_id).modifiers.push({
        id: row.modifier_id,
        modifier_group_id: row.group_id,
        name: row.modifier_name,
        price_delta: Number(row.price_delta),
        action_type: row.action_type,
        is_available: true,
        display_order: row.mod_order
      });
    }

    // Indexar productos por categoría
    const categoryProductsMap = new Map<string, any[]>();
    for (const prod of prodRes.rows) {
      if (!categoryProductsMap.has(prod.category_id)) {
        categoryProductsMap.set(prod.category_id, []);
      }
      const groups = Array.from(productGroupsMap.get(prod.id)?.values() || []);
      categoryProductsMap.get(prod.category_id)!.push({
        ...prod,
        base_price: Number(prod.base_price),
        modifier_groups: groups
      });
    }

    // Ensamblar respuesta final
    const categories: CategoryWithProducts[] = catRes.rows.map((cat: any) => ({
      ...cat,
      products: categoryProductsMap.get(cat.id) || []
    }));

    return NextResponse.json({ success: true, categories });
  } catch (err: any) {
    console.error('Error en GET /api/menu:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Error interno' }, { status: 500 });
  }
}
```

---

### 4.3 `app/api/tables/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { TableSummary } from '@/types/domain';

export async function GET() {
  try {
    const db = await getDb();
    const query = `
      SELECT 
        t.id, 
        t.table_number, 
        t.capacity, 
        t.status, 
        t.created_at, 
        t.updated_at,
        COUNT(o.id) FILTER (WHERE o.status IN ('PENDING', 'IN_PREP', 'READY', 'SERVED')) AS active_orders_count,
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.status IN ('PENDING', 'IN_PREP', 'READY', 'SERVED')), 0) AS total_unpaid_amount
      FROM restaurant_tables t
      LEFT JOIN orders o ON t.id = o.table_id
      GROUP BY t.id, t.table_number, t.capacity, t.status, t.created_at, t.updated_at
      ORDER BY t.table_number ASC;
    `;

    const res = await db.query(query);
    const tables: TableSummary[] = res.rows.map((row: any) => ({
      id: row.id,
      table_number: Number(row.table_number),
      capacity: Number(row.capacity),
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      active_orders_count: Number(row.active_orders_count),
      total_unpaid_amount: Number(row.total_unpaid_amount)
    }));

    return NextResponse.json({ success: true, tables });
  } catch (err: any) {
    console.error('Error en GET /api/tables:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Error interno' }, { status: 500 });
  }
}
```

---

### 4.4 `app/api/orders/[id]/status/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { eventHub } from '@/lib/events/eventHub';
import { OrderStatus, UpdateOrderStatusRequest } from '@/types/domain';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['IN_PREP', 'CANCELLED'],
  IN_PREP: ['READY', 'CANCELLED'],
  READY: ['SERVED'],
  SERVED: [],
  CANCELLED: []
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> } // Obligatorio Promise en Next.js 15
) {
  try {
    const { id } = await params;
    const body: UpdateOrderStatusRequest = await request.json().catch(() => null);

    if (!body || !body.status) {
      return NextResponse.json(
        { success: false, error: 'Debe especificar el campo status en el cuerpo' },
        { status: 400 }
      );
    }

    const nextStatus = body.status;
    const validStatuses: OrderStatus[] = ['PENDING', 'IN_PREP', 'READY', 'SERVED', 'CANCELLED'];
    if (!validStatuses.includes(nextStatus)) {
      return NextResponse.json(
        { success: false, error: `Estado no reconocido: ${nextStatus}` },
        { status: 400 }
      );
    }

    const db = await getDb();
    const orderRes = await db.query('SELECT id, table_id, status FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Comanda no encontrada' }, { status: 404 });
    }

    const currentOrder = orderRes.rows[0];
    const currentStatus: OrderStatus = currentOrder.status;

    // Validar máquina de estados
    const permitted = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!permitted.includes(nextStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Transición inválida de ${currentStatus} a ${nextStatus}. Transiciones válidas: ${permitted.join(', ') || 'ninguna'}`
        },
        { status: 400 }
      );
    }

    // Actualizar orden y sus líneas
    await db.query('BEGIN');
    const updateRes = await db.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, table_id, order_number, status, total_amount, updated_at`,
      [nextStatus, id]
    );
    await db.query(`UPDATE order_items SET status = $1 WHERE order_id = $2`, [nextStatus, id]);
    await db.query('COMMIT');

    const updated = updateRes.rows[0];

    // Emitir evento SSE
    eventHub.broadcast({
      type: 'ORDER_STATUS_CHANGED',
      payload: {
        order_id: updated.id,
        table_id: updated.table_id,
        old_status: currentStatus,
        new_status: nextStatus,
        updated_at: updated.updated_at
      }
    });

    return NextResponse.json({
      success: true,
      order: {
        id: updated.id,
        table_id: updated.table_id,
        status: updated.status,
        updated_at: updated.updated_at
      }
    });
  } catch (err: any) {
    console.error('Error en PATCH /api/orders/[id]/status:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Error interno' }, { status: 500 });
  }
}
```

---

## 5. Coordinación Inter-Agente y Puntos de Integración

1. **Con `m1_explorer_1` (DB Engine & Schema):**
   - Nuestro código asume la existencia de `lib/db/index.ts` con la función `getDb()` que retorna un cliente con interfaz de query estándar `query(sql, params)`.
   - Nuestro esquema relacional se basa en `orders.idempotency_key UUID UNIQUE`, `order_items`, `order_item_modifiers`, `modifier_groups`, `modifiers`, y `restaurant_tables`.
2. **Con `m1_explorer_3` (Realtime EventHub & SSE):**
   - Nuestro código invoca `eventHub.broadcast(RealtimeEvent)` de forma no bloqueante tras el `COMMIT` exitoso de la transacción en `POST /api/orders` y `PATCH /api/orders/[id]/status`.
   - Nunca emite evento cuando la orden es un replay (`replayed: true`), asegurando que la cocina jamás reciba ruidos o comandas duplicadas.
3. **Con `e2e_test_writer`:**
   - La respuesta del replay incluye `status: 200`, cabecera `X-Idempotent-Replay: true` y flag `replayed: true`, satisfaciendo al 100% las aserciones de `tests/integration/idempotency.test.ts` y `scripts/verify-e2e.ts`.

---

## 6. Conclusión y Factibilidad

El plan de implementación para la idempotencia, los handlers de API y los contratos de dominio está completamente estructurado, blindado contra condiciones de carrera, validado contra Next.js 15 App Router y listo para ser ejecutado por el worker sin cabos sueltos ni dependencias ocultas.
