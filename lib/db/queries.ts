// ============================================================================
// lib/db/queries.ts — Type-Safe Database Query Operations
// ============================================================================

import { getDb, DbClient } from './index';
import {
  TableSummary,
  CategoryWithProducts,
  Product,
  ModifierGroup,
  Modifier,
  OrderStatus,
  OrderSummary,
  OrderItemInput,
  Bill,
  PaymentMethod,
} from '@/types/domain';

export interface CreateOrderParams {
  table_id: string;
  idempotency_key: string;
  items: OrderItemInput[];
}

export interface CreatedOrderResult {
  order: OrderSummary;
  replayed: boolean;
}

// ----------------------------------------------------------------------------
// 1. TABLES QUERIES
// ----------------------------------------------------------------------------

export async function getTables(): Promise<TableSummary[]> {
  const db = await getDb();

  const tablesRes = await db.query(`
    SELECT 
      t.id,
      t.table_number,
      t.capacity,
      t.status,
      t.created_at,
      t.updated_at
    FROM restaurant_tables t
    ORDER BY t.table_number ASC;
  `);

  const activeOrdersRes = await db.query(`
    SELECT id, table_id, total_amount
    FROM orders
    WHERE status IN ('PENDING', 'IN_PREP', 'READY', 'SERVED');
  `);

  const activeOrdersByTable = new Map<string, { ids: string[]; total: number }>();
  for (const row of activeOrdersRes.rows) {
    if (!activeOrdersByTable.has(row.table_id)) {
      activeOrdersByTable.set(row.table_id, { ids: [], total: 0 });
    }
    const entry = activeOrdersByTable.get(row.table_id)!;
    entry.ids.push(row.id);
    entry.total += Number(row.total_amount);
  }

  return tablesRes.rows.map((row: any) => {
    const active = activeOrdersByTable.get(row.id) || { ids: [], total: 0 };
    return {
      id: row.id,
      table_number: Number(row.table_number),
      capacity: Number(row.capacity),
      status: row.status,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
      active_orders: active.ids,
      active_orders_count: active.ids.length,
      total_unpaid_amount: active.total,
    };
  });
}

// ----------------------------------------------------------------------------
// 2. MENU & CATALOG QUERIES
// ----------------------------------------------------------------------------

export async function getMenu(): Promise<{
  categories: CategoryWithProducts[];
  products: Product[];
}> {
  const db = await getDb();

  // 1. Categories
  const catRes = await db.query(`
    SELECT id, name, display_order, is_active, created_at
    FROM categories
    WHERE is_active = TRUE
    ORDER BY display_order ASC;
  `);

  // 2. Products
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

  // 3. Modifier Groups & Modifiers
  const modRes = await db.query(`
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
      m.display_order AS mod_order
    FROM product_modifier_groups pmg
    JOIN modifier_groups mg ON pmg.modifier_group_id = mg.id
    JOIN modifiers m ON m.modifier_group_id = mg.id
    WHERE m.is_available = TRUE
    ORDER BY pmg.display_order ASC, m.display_order ASC;
  `);

  // Group modifiers by product and modifier group
  const productGroupsMap = new Map<string, Map<string, ModifierGroup>>();
  for (const row of modRes.rows) {
    if (!productGroupsMap.has(row.product_id)) {
      productGroupsMap.set(row.product_id, new Map());
    }
    const groups = productGroupsMap.get(row.product_id)!;
    if (!groups.has(row.group_id)) {
      groups.set(row.group_id, {
        id: row.group_id,
        name: row.group_name,
        min_selection: Number(row.min_selection),
        max_selection: Number(row.max_selection),
        modifiers: [],
      });
    }
    groups.get(row.group_id)!.modifiers.push({
      id: row.modifier_id,
      modifier_group_id: row.group_id,
      name: row.modifier_name,
      price_delta: Number(row.price_delta),
      action_type: row.action_type,
      is_available: true,
      display_order: Number(row.mod_order),
    });
  }

  // Build product list with nested modifier groups
  const productList: Product[] = prodRes.rows.map((p: any) => {
    const groups = Array.from(productGroupsMap.get(p.id)?.values() || []);
    return {
      id: p.id,
      category_id: p.category_id,
      category: p.category,
      name: p.name,
      description: p.description,
      base_price: Number(p.base_price),
      image_url: p.image_url,
      is_available: Boolean(p.is_available),
      modifier_groups: groups,
      created_at: p.created_at ? new Date(p.created_at).toISOString() : undefined,
      updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : undefined,
    };
  });

  // Group products by category
  const productsByCat = new Map<string, Product[]>();
  for (const p of productList) {
    if (!productsByCat.has(p.category_id!)) {
      productsByCat.set(p.category_id!, []);
    }
    productsByCat.get(p.category_id!)!.push(p);
  }

  const categories: CategoryWithProducts[] = catRes.rows.map((cat: any) => ({
    id: cat.id,
    name: cat.name,
    display_order: Number(cat.display_order),
    is_active: Boolean(cat.is_active),
    created_at: cat.created_at ? new Date(cat.created_at).toISOString() : undefined,
    products: productsByCat.get(cat.id) || [],
  }));

  return {
    categories,
    products: productList,
  };
}

// ----------------------------------------------------------------------------
// 3. ATOMIC ORDER CREATION & IDEMPOTENCY
// ----------------------------------------------------------------------------

export async function fetchFullOrderById(
  client: DbClient,
  orderId: string
): Promise<OrderSummary | null> {
  const orderRes = await client.query(
    `SELECT o.*, t.table_number 
     FROM orders o 
     JOIN restaurant_tables t ON o.table_id = t.id 
     WHERE o.id = $1`,
    [orderId]
  );
  if (orderRes.rows.length === 0) return null;
  const o = orderRes.rows[0];

  const itemsRes = await client.query(
    `SELECT oi.id, oi.product_id, p.name AS product_name, oi.quantity, oi.unit_price, oi.subtotal, oi.status
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1
     ORDER BY oi.created_at ASC`,
    [o.id]
  );

  const itemIds = itemsRes.rows.map((i: any) => i.id);
  const modsMap = new Map<string, any[]>();

  if (itemIds.length > 0) {
    const modsRes = await client.query(
      `SELECT oim.order_item_id, m.id AS modifier_id, m.name, oim.unit_price_delta AS price_delta, m.action_type
       FROM order_item_modifiers oim
       JOIN modifiers m ON oim.modifier_id = m.id
       WHERE oim.order_item_id = ANY($1::text[])`,
      [itemIds]
    );

    for (const m of modsRes.rows) {
      if (!modsMap.has(m.order_item_id)) modsMap.set(m.order_item_id, []);
      modsMap.get(m.order_item_id)!.push({
        modifier_id: m.modifier_id,
        name: m.name,
        price_delta: Number(m.price_delta),
        action_type: m.action_type,
      });
    }
  }

  return {
    id: o.id,
    table_id: o.table_id,
    table_number: Number(o.table_number),
    idempotency_key: o.idempotency_key,
    order_number: Number(o.order_number),
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
      modifiers: modsMap.get(i.id) || [],
    })),
  };
}

export async function fetchFullOrderByIdempotencyKey(
  client: DbClient,
  idempotency_key: string
): Promise<OrderSummary | null> {
  const orderRes = await client.query(
    `SELECT id FROM orders WHERE idempotency_key = $1`,
    [idempotency_key]
  );
  if (orderRes.rows.length === 0) return null;
  return await fetchFullOrderById(client, orderRes.rows[0].id);
}

export async function createOrderAtomic(params: CreateOrderParams): Promise<CreatedOrderResult> {
  const db = await getDb();

  // 1. Fast check if idempotency_key already exists
  const existingOrder = await fetchFullOrderByIdempotencyKey(db, params.idempotency_key);
  if (existingOrder) {
    return { order: existingOrder, replayed: true };
  }

  // 2. Validate table existence
  const tableCheck = await db.query(
    `SELECT id, table_number, status FROM restaurant_tables WHERE id = $1`,
    [params.table_id]
  );
  if (tableCheck.rows.length === 0) {
    throw new Error(`Restaurant table not found: ${params.table_id}`);
  }
  const tableRow = tableCheck.rows[0];

  // 3. Validate items array
  if (!Array.isArray(params.items) || params.items.length === 0) {
    throw new Error('Order must contain at least one item');
  }

  // 4. Fetch catalog rules for products and modifiers
  const productIds = params.items.map((i) => i.product_id);
  const productsRes = await db.query(
    `SELECT id, name, base_price, is_available FROM products WHERE id = ANY($1::text[])`,
    [productIds]
  );
  const productMap = new Map(productsRes.rows.map((p) => [p.id, p]));

  const rulesRes = await db.query(
    `SELECT 
       pmg.product_id, mg.id AS group_id, mg.name AS group_name, mg.min_selection, mg.max_selection,
       m.id AS modifier_id, m.name AS modifier_name, m.price_delta, m.action_type
     FROM product_modifier_groups pmg
     JOIN modifier_groups mg ON pmg.modifier_group_id = mg.id
     JOIN modifiers m ON m.modifier_group_id = mg.id
     WHERE pmg.product_id = ANY($1::text[]) AND m.is_available = TRUE`,
    [productIds]
  );

  const productRules = new Map<string, { groups: Map<string, any>; modifiers: Map<string, any> }>();
  for (const r of rulesRes.rows) {
    if (!productRules.has(r.product_id)) {
      productRules.set(r.product_id, { groups: new Map(), modifiers: new Map() });
    }
    const entry = productRules.get(r.product_id)!;
    if (!entry.groups.has(r.group_id)) {
      entry.groups.set(r.group_id, {
        id: r.group_id,
        name: r.group_name,
        min_selection: Number(r.min_selection),
        max_selection: Number(r.max_selection),
        modifierIds: new Set<string>(),
      });
    }
    entry.groups.get(r.group_id).modifierIds.add(r.modifier_id);
    entry.modifiers.set(r.modifier_id, {
      id: r.modifier_id,
      name: r.modifier_name,
      price_delta: Number(r.price_delta),
      action_type: r.action_type,
      group_id: r.group_id,
    });
  }

  // 5. Pre-validate quantities, modifiers, cardinalities, and compute prices
  let orderTotal = 0;
  const processedItems: {
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    modifiers: { modifier_id: string; name: string; price_delta: number; action_type: any }[];
  }[] = [];

  for (const item of params.items) {
    if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      throw new Error('Item quantity must be a positive integer');
    }

    const prod = productMap.get(item.product_id);
    if (!prod || !prod.is_available) {
      throw new Error(`Invalid or unavailable product_id: ${item.product_id}`);
    }

    const rules = productRules.get(item.product_id);

    // Normalize modifier IDs
    const selectedModIds: string[] = [
      ...(item.modifier_ids || []),
      ...(item.modifiers?.map((m) => (typeof m === 'string' ? m : m.modifier_id)) || []),
    ];

    // Cardinality validation
    if (rules) {
      for (const [, group] of rules.groups) {
        const countInGroup = selectedModIds.filter((mid) => group.modifierIds.has(mid)).length;
        if (countInGroup < group.min_selection) {
          throw new Error(
            `Modifier group '${group.name}' requires minimum ${group.min_selection} selections`
          );
        }
        if (countInGroup > group.max_selection) {
          throw new Error(
            `Modifier group '${group.name}' permits maximum ${group.max_selection} selections`
          );
        }
      }
    }

    // Modifier belonging validation and delta price sum
    let modifiersDelta = 0;
    const validatedMods: any[] = [];
    for (const modId of selectedModIds) {
      const mod = rules?.modifiers.get(modId);
      if (!mod) {
        throw new Error(`Modifier '${modId}' is not applicable to product '${prod.name}'`);
      }
      modifiersDelta += mod.price_delta;
      validatedMods.push({
        modifier_id: mod.id,
        name: mod.name,
        price_delta: mod.price_delta,
        action_type: mod.action_type,
      });
    }

    const unitPrice = Number(prod.base_price) + modifiersDelta;
    const subtotal = unitPrice * item.quantity;
    orderTotal += subtotal;

    processedItems.push({
      product_id: prod.id,
      product_name: prod.name,
      quantity: item.quantity,
      unit_price: unitPrice,
      subtotal,
      modifiers: validatedMods,
    });
  }

  // 6. Execute atomic insertion inside transaction
  return await db.transaction(async (tx) => {
    // Check again inside transaction to prevent concurrency collision
    const orderInsert = await tx.query(
      `INSERT INTO orders (table_id, idempotency_key, status, total_amount, created_at, updated_at)
       VALUES ($1, $2, 'PENDING', $3, NOW(), NOW())
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id, order_number, table_id, idempotency_key, status, total_amount, created_at, updated_at`,
      [params.table_id, params.idempotency_key, orderTotal]
    );

    if (orderInsert.rows.length === 0) {
      // Conflict: concurrent transaction already created it
      const replayed = await fetchFullOrderByIdempotencyKey(tx, params.idempotency_key);
      if (!replayed) {
        throw new Error('Concurrent order creation conflict resolution failed');
      }
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
      const orderItemId = itemInsert.rows[0].id;

      for (const mod of pItem.modifiers) {
        await tx.query(
          `INSERT INTO order_item_modifiers (order_item_id, modifier_id, unit_price_delta, created_at)
           VALUES ($1, $2, $3, NOW())`,
          [orderItemId, mod.modifier_id, mod.price_delta]
        );
      }

      insertedItems.push({
        id: orderItemId,
        product_id: pItem.product_id,
        product_name: pItem.product_name,
        quantity: pItem.quantity,
        unit_price: pItem.unit_price,
        subtotal: pItem.subtotal,
        status: 'PENDING',
        modifiers: pItem.modifiers,
      });
    }

    // Update table status to OCCUPIED
    await tx.query(
      `UPDATE restaurant_tables SET status = 'OCCUPIED', updated_at = NOW() WHERE id = $1`,
      [params.table_id]
    );

    const fullOrder: OrderSummary = {
      id: orderRow.id,
      table_id: orderRow.table_id,
      table_number: Number(tableRow.table_number),
      idempotency_key: orderRow.idempotency_key,
      order_number: Number(orderRow.order_number),
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
// 4. KITCHEN KDS STATUS TRANSITIONS
// ----------------------------------------------------------------------------

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

  const orderRes = await db.query(`SELECT id, table_id, status FROM orders WHERE id = $1`, [orderId]);
  if (orderRes.rows.length === 0) {
    throw new Error('Order not found');
  }

  const currentOrder = orderRes.rows[0];
  const oldStatus: OrderStatus = currentOrder.status;

  const allowed = VALID_TRANSITIONS[oldStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid transition from ${oldStatus} to ${newStatus}`);
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

  const updated = await fetchFullOrderById(db, orderId);
  return { order: updated!, oldStatus };
}

// ----------------------------------------------------------------------------
// 5. BILLING & SETTLEMENT QUERIES
// ----------------------------------------------------------------------------

export async function getTableBill(tableId: string): Promise<Bill> {
  const db = await getDb();

  const tableCheck = await db.query(`SELECT id FROM restaurant_tables WHERE id = $1`, [tableId]);
  if (tableCheck.rows.length === 0) {
    throw new Error('Table not found');
  }

  // Find existing open bill or active orders
  const ordersRes = await db.query(
    `SELECT id FROM orders WHERE table_id = $1 AND status != 'CANCELLED' ORDER BY created_at ASC`,
    [tableId]
  );

  const fullOrders: OrderSummary[] = [];
  for (const o of ordersRes.rows) {
    const fo = await fetchFullOrderById(db, o.id);
    if (fo) fullOrders.push(fo);
  }

  const subtotal = fullOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const tax = Math.round(subtotal * 0.08); // 8% Impoconsumo
  const tip = Math.round(subtotal * 0.1); // 10% voluntary tip
  const total = subtotal + tax + tip;

  // Check if bill record exists in bills table
  const billRes = await db.query(
    `SELECT id, status, payment_method, paid_at, created_at FROM bills WHERE table_id = $1 AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1`,
    [tableId]
  );

  let billId: string;
  let billStatus: any = 'OPEN';
  let paymentMethod: any = null;
  let paidAt: string | null = null;

  if (billRes.rows.length > 0) {
    billId = billRes.rows[0].id;
    billStatus = billRes.rows[0].status;
    paymentMethod = billRes.rows[0].payment_method;
    paidAt = billRes.rows[0].paid_at ? new Date(billRes.rows[0].paid_at).toISOString() : null;

    await db.query(
      `UPDATE bills SET subtotal = $1, tax = $2, tip = $3, total = $4 WHERE id = $5`,
      [subtotal, tax, tip, total, billId]
    );
  } else {
    const insertBill = await db.query(
      `INSERT INTO bills (table_id, subtotal, tax, tip, total, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'OPEN', NOW())
       RETURNING id`,
      [tableId, subtotal, tax, tip, total]
    );
    billId = insertBill.rows[0].id;
  }

  return {
    id: billId,
    table_id: tableId,
    subtotal,
    tax,
    tip,
    total,
    orders_count: fullOrders.length,
    orders: fullOrders,
    status: billStatus,
    payment_method: paymentMethod,
    paid_at: paidAt,
  };
}

export async function payTableBill(
  tableId: string,
  paymentMethod: PaymentMethod,
  tenderedAmount?: number
): Promise<{ bill: Bill; change_due: number }> {
  const db = await getDb();
  const bill = await getTableBill(tableId);

  if (bill.status === 'PAID') {
    throw new Error('Bill already paid');
  }

  if (paymentMethod === 'CASH' && tenderedAmount !== undefined) {
    if (tenderedAmount < bill.total) {
      throw new Error('Tendered amount is less than total bill');
    }
  }

  const changeDue =
    paymentMethod === 'CASH' && tenderedAmount ? Math.max(0, tenderedAmount - bill.total) : 0;

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE bills SET status = 'PAID', payment_method = $1, paid_at = $2 WHERE id = $3`,
      [paymentMethod, now, bill.id]
    );

    await tx.query(
      `INSERT INTO payments (bill_id, payment_method, amount, tendered_amount, change_due, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [bill.id, paymentMethod, bill.total, tenderedAmount ?? null, changeDue, now]
    );
  });

  bill.status = 'PAID';
  bill.payment_method = paymentMethod;
  bill.paid_at = now.toISOString();

  return { bill, change_due: changeDue };
}

export async function closeTable(tableId: string): Promise<void> {
  const db = await getDb();
  const tableCheck = await db.query(`SELECT id FROM restaurant_tables WHERE id = $1`, [tableId]);
  if (tableCheck.rows.length === 0) {
    throw new Error('Table not found');
  }

  await db.transaction(async (tx) => {
    await tx.query(
      `UPDATE restaurant_tables SET status = 'AVAILABLE', updated_at = NOW() WHERE id = $1`,
      [tableId]
    );
    await tx.query(`DELETE FROM bills WHERE table_id = $1`, [tableId]);
  });
}
