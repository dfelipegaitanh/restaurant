// ============================================================================
// lib/db/queries.ts — Fast-Casual Kiosk & KDS Database Operations
// ============================================================================

import { getDb, DbClient } from './index';
import {
  CategoryWithProducts,
  Product,
  OrderStatus,
  OrderSummary,
  OrderItemInput,
} from '@/types/domain';

export interface CreateOrderParams {
  idempotency_key: string;
  customer_name?: string;
  items: OrderItemInput[];
}

export interface CreatedOrderResult {
  order: OrderSummary;
  replayed: boolean;
}

// ----------------------------------------------------------------------------
// 1. MENU & CATALOG QUERIES
// ----------------------------------------------------------------------------

export async function getMenu(): Promise<{
  categories: CategoryWithProducts[];
  products: Product[];
}> {
  const db = await getDb();

  // 1. Fetch active categories ordered by display_order
  const catRes = await db.query(`
    SELECT id, name, display_order, is_active, created_at
    FROM categories
    WHERE is_active = TRUE
    ORDER BY display_order ASC;
  `);

  // 2. Fetch available products
  const prodRes = await db.query(`
    SELECT 
      p.id,
      p.category_id,
      c.name as category,
      p.name,
      p.description,
      p.base_price,
      p.image_url,
      p.is_available,
      p.created_at,
      p.updated_at
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.is_available = TRUE
    ORDER BY p.name ASC;
  `);

  const products: Product[] = prodRes.rows.map((r: any) => ({
    id: r.id,
    category_id: r.category_id,
    category: r.category,
    name: r.name,
    description: r.description || '',
    base_price: Number(r.base_price),
    image_url: r.image_url || '🍽️',
    is_available: r.is_available,
    created_at: new Date(r.created_at).toISOString(),
    updated_at: new Date(r.updated_at).toISOString(),
  }));

  const categoryMap = new Map<string, CategoryWithProducts>();
  for (const c of catRes.rows) {
    categoryMap.set(c.id, {
      id: c.id,
      name: c.name,
      display_order: Number(c.display_order),
      is_active: c.is_active,
      created_at: new Date(c.created_at).toISOString(),
      products: [],
    });
  }

  for (const prod of products) {
    const cat = categoryMap.get(prod.category_id);
    if (cat) {
      cat.products.push(prod);
    }
  }

  return {
    categories: Array.from(categoryMap.values()),
    products,
  };
}

// ----------------------------------------------------------------------------
// 2. ATOMIC ORDER INGESTION (KIOSK FAST-CASUAL WITH IDEMPOTENCY)
// ----------------------------------------------------------------------------

export async function fetchFullOrderByIdempotencyKey(
  client: DbClient,
  idempotencyKey: string
): Promise<OrderSummary | null> {
  const orderRes = await client.query(
    `SELECT id, order_number, idempotency_key, customer_name, status, total_amount, created_at, updated_at
     FROM orders
     WHERE idempotency_key = $1`,
    [idempotencyKey]
  );

  if (orderRes.rows.length === 0) return null;
  const o = orderRes.rows[0];

  const itemsRes = await client.query(
    `SELECT oi.id, oi.product_id, p.name as product_name, oi.quantity, oi.unit_price, oi.subtotal, oi.status
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1
     ORDER BY oi.created_at ASC`,
    [o.id]
  );

  return {
    id: o.id,
    order_number: Number(o.order_number),
    idempotency_key: o.idempotency_key,
    customer_name: o.customer_name || null,
    status: o.status,
    total_amount: Number(o.total_amount),
    created_at: new Date(o.created_at).toISOString(),
    updated_at: new Date(o.updated_at).toISOString(),
    items: itemsRes.rows.map((i: any) => ({
      id: i.id,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      subtotal: Number(i.subtotal),
      status: i.status,
    })),
  };
}

export async function createOrderAtomic(params: CreateOrderParams): Promise<CreatedOrderResult> {
  const db = await getDb();

  // 1. Fast check if idempotency_key already exists
  const existingOrder = await fetchFullOrderByIdempotencyKey(db, params.idempotency_key);
  if (existingOrder) {
    return { order: existingOrder, replayed: true };
  }

  // 2. Validate items array
  if (!Array.isArray(params.items) || params.items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  // 3. Fetch products to calculate authoritative server-side price
  const productIds = params.items.map((i) => i.product_id);
  const productsRes = await db.query(
    `SELECT id, name, base_price, is_available FROM products WHERE id = ANY($1::text[])`,
    [productIds]
  );
  const productMap = new Map(productsRes.rows.map((p) => [p.id, p]));

  let orderTotal = 0;
  const processedItems: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[] = [];

  for (const item of params.items) {
    if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      throw new Error('Item quantity must be a positive integer');
    }

    const prod = productMap.get(item.product_id);
    if (!prod || !prod.is_available) {
      throw new Error(`Invalid or unavailable product_id: ${item.product_id}`);
    }

    const unitPrice = Number(prod.base_price);
    const subtotal = Number((unitPrice * item.quantity).toFixed(2));
    orderTotal = Number((orderTotal + subtotal).toFixed(2));

    processedItems.push({
      product_id: prod.id,
      product_name: prod.name,
      quantity: item.quantity,
      unit_price: unitPrice,
      subtotal,
    });
  }

  // 4. Atomic transaction insertion
  return await db.transaction(async (tx) => {
    const orderInsert = await tx.query(
      `INSERT INTO orders (idempotency_key, customer_name, status, total_amount, created_at, updated_at)
       VALUES ($1, $2, 'PENDING', $3, NOW(), NOW())
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id, order_number, idempotency_key, customer_name, status, total_amount, created_at, updated_at`,
      [params.idempotency_key, params.customer_name || null, orderTotal]
    );

    if (orderInsert.rows.length === 0) {
      const replayed = await fetchFullOrderByIdempotencyKey(tx, params.idempotency_key);
      if (!replayed) throw new Error('Concurrent order creation collision resolution failed');
      return { order: replayed, replayed: true };
    }

    const orderRow = orderInsert.rows[0];
    const orderId = orderRow.id;
    const insertedItems: any[] = [];

    for (const pItem of processedItems) {
      const itemInsert = await tx.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW())
         RETURNING id`,
        [orderId, pItem.product_id, pItem.quantity, pItem.unit_price, pItem.subtotal]
      );

      insertedItems.push({
        id: itemInsert.rows[0].id,
        product_id: pItem.product_id,
        product_name: pItem.product_name,
        quantity: pItem.quantity,
        unit_price: pItem.unit_price,
        subtotal: pItem.subtotal,
        status: 'PENDING',
      });
    }

    const fullOrder: OrderSummary = {
      id: orderRow.id,
      order_number: Number(orderRow.order_number),
      idempotency_key: orderRow.idempotency_key,
      customer_name: orderRow.customer_name || null,
      status: orderRow.status,
      total_amount: Number(orderRow.total_amount),
      created_at: new Date(orderRow.created_at).toISOString(),
      updated_at: new Date(orderRow.updated_at).toISOString(),
      items: insertedItems,
    };

    return { order: fullOrder, replayed: false };
  });
}

// ----------------------------------------------------------------------------
// 3. KITCHEN KDS QUERIES & STATUS TRANSITIONS
// ----------------------------------------------------------------------------

export async function getKitchenOrders(): Promise<OrderSummary[]> {
  const db = await getDb();

  const ordersRes = await db.query(`
    SELECT id, order_number, idempotency_key, customer_name, status, total_amount, created_at, updated_at
    FROM orders
    WHERE status IN ('PENDING', 'IN_PREP', 'READY')
    ORDER BY created_at ASC;
  `);

  if (ordersRes.rows.length === 0) return [];

  const orderIds = ordersRes.rows.map((o) => o.id);
  const itemsRes = await db.query(
    `SELECT oi.id, oi.order_id, oi.product_id, p.name as product_name, oi.quantity, oi.unit_price, oi.subtotal, oi.status
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ANY($1::text[])
     ORDER BY oi.created_at ASC`,
    [orderIds]
  );

  const itemsByOrder = new Map<string, any[]>();
  for (const row of itemsRes.rows) {
    if (!itemsByOrder.has(row.order_id)) itemsByOrder.set(row.order_id, []);
    itemsByOrder.get(row.order_id)!.push({
      id: row.id,
      product_id: row.product_id,
      product_name: row.product_name,
      quantity: Number(row.quantity),
      unit_price: Number(row.unit_price),
      subtotal: Number(row.subtotal),
      status: row.status,
    });
  }

  return ordersRes.rows.map((o: any) => ({
    id: o.id,
    order_number: Number(o.order_number),
    idempotency_key: o.idempotency_key,
    customer_name: o.customer_name || null,
    status: o.status,
    total_amount: Number(o.total_amount),
    created_at: new Date(o.created_at).toISOString(),
    updated_at: new Date(o.updated_at).toISOString(),
    items: itemsByOrder.get(o.id) || [],
  }));
}

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['IN_PREP', 'CANCELLED'],
  IN_PREP: ['READY', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
  SERVED: [],
  CANCELLED: [],
};

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus
): Promise<{ order: OrderSummary; oldStatus: OrderStatus }> {
  const db = await getDb();

  const orderRes = await db.query(`SELECT id, status FROM orders WHERE id = $1`, [orderId]);
  if (orderRes.rows.length === 0) {
    throw new Error('Order not found');
  }

  const currentOrder = orderRes.rows[0];
  const oldStatus: OrderStatus = currentOrder.status;

  if (oldStatus === newStatus) {
    const full = await fetchFullOrderById(orderId);
    return { order: full, oldStatus };
  }

  const allowed = VALID_TRANSITIONS[oldStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid status transition from '${oldStatus}' to '${newStatus}'`);
  }

  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, orderId]
    );
    await tx.query(
      `UPDATE order_items SET status = $1 WHERE order_id = $2`,
      [newStatus, orderId]
    );
  });

  const updatedOrder = await fetchFullOrderById(orderId);
  return { order: updatedOrder, oldStatus };
}

export async function fetchFullOrderById(orderId: string): Promise<OrderSummary> {
  const db = await getDb();
  const orderRes = await db.query(
    `SELECT id, order_number, idempotency_key, customer_name, status, total_amount, created_at, updated_at
     FROM orders WHERE id = $1`,
    [orderId]
  );

  if (orderRes.rows.length === 0) throw new Error('Order not found');
  const o = orderRes.rows[0];

  const itemsRes = await db.query(
    `SELECT oi.id, oi.product_id, p.name as product_name, oi.quantity, oi.unit_price, oi.subtotal, oi.status
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1
     ORDER BY oi.created_at ASC`,
    [o.id]
  );

  return {
    id: o.id,
    order_number: Number(o.order_number),
    idempotency_key: o.idempotency_key,
    customer_name: o.customer_name || null,
    status: o.status,
    total_amount: Number(o.total_amount),
    created_at: new Date(o.created_at).toISOString(),
    updated_at: new Date(o.updated_at).toISOString(),
    items: itemsRes.rows.map((i: any) => ({
      id: i.id,
      product_id: i.product_id,
      product_name: i.product_name,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      subtotal: Number(i.subtotal),
      status: i.status,
    })),
  };
}
