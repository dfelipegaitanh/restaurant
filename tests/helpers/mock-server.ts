import http from 'node:http';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

export const globalEventBus = new EventEmitter();

// In-memory relational state according to PROJECT.md & survey_miner_db
let tables: Record<string, any> = {
  'table-1': { id: 'table-1', table_number: 1, capacity: 4, status: 'AVAILABLE' },
  'table-2': { id: 'table-2', table_number: 2, capacity: 2, status: 'AVAILABLE' },
  'table-3': { id: 'table-3', table_number: 3, capacity: 4, status: 'AVAILABLE' },
  'table-4': { id: 'table-4', table_number: 4, capacity: 6, status: 'AVAILABLE' },
  'table-5': { id: 'table-5', table_number: 5, capacity: 4, status: 'AVAILABLE' },
  'table-6': { id: 'table-6', table_number: 6, capacity: 4, status: 'AVAILABLE' },
  'table-7': { id: 'table-7', table_number: 7, capacity: 2, status: 'AVAILABLE' },
  'table-8': { id: 'table-8', table_number: 8, capacity: 8, status: 'AVAILABLE' },
};

const modifierGroups: Record<string, any> = {
  'mod-group-doneness': {
    id: 'mod-group-doneness',
    name: 'Término de la Carne',
    min_selection: 1,
    max_selection: 1,
    modifiers: [
      { id: 'mod-doneness-med', name: 'Término Medio', price_delta: 0, action_type: 'OPTION' },
      { id: 'mod-doneness-34', name: 'Tres Cuartos', price_delta: 0, action_type: 'OPTION' },
      { id: 'mod-doneness-well', name: 'Bien Asada', price_delta: 0, action_type: 'OPTION' },
    ],
  },
  'mod-group-toppings': {
    id: 'mod-group-toppings',
    name: 'Adiciones & Ajustes',
    min_selection: 0,
    max_selection: 3,
    modifiers: [
      { id: 'mod-extra-bacon', name: 'Extra Tocineta Ahumada', price_delta: 4500, action_type: 'EXTRA' },
      { id: 'mod-extra-cheese', name: 'Doble Queso Cheddar', price_delta: 3500, action_type: 'EXTRA' },
      { id: 'mod-no-onion', name: 'Sin Cebolla', price_delta: 0, action_type: 'NO' },
    ],
  },
  'mod-group-sauces': {
    id: 'mod-group-sauces',
    name: 'Salsas Artesanales',
    min_selection: 0,
    max_selection: 2,
    modifiers: [
      { id: 'mod-sauce-garlic', name: 'Salsa de Ajo Casera', price_delta: 1500, action_type: 'OPTION' },
      { id: 'mod-sauce-bbq', name: 'BBQ Ahumada', price_delta: 1500, action_type: 'OPTION' },
    ],
  },
};

const products: Record<string, any> = {
  'prod-burger-classic': {
    id: 'prod-burger-classic',
    name: 'Hamburguesa Clásica Bogotana',
    category: 'Hamburguesas',
    base_price: 24000,
    is_available: true,
    modifier_groups: [modifierGroups['mod-group-doneness'], modifierGroups['mod-group-toppings']],
  },
  'prod-fries-rustic': {
    id: 'prod-fries-rustic',
    name: 'Papas Rústicas',
    category: 'Acompañamientos',
    base_price: 8000,
    is_available: true,
    modifier_groups: [modifierGroups['mod-group-sauces']],
  },
  'prod-drink-lemonade': {
    id: 'prod-drink-lemonade',
    name: 'Limonada Natural',
    category: 'Bebidas',
    base_price: 7000,
    is_available: true,
    modifier_groups: [],
  },
};

// State storage
let orders: Record<string, any> = {};
let idempotencyMap: Record<string, string> = {}; // idempotency_key -> order_id
let bills: Record<string, any> = {}; // table_id -> bill
let orderNumberSeq = 100;

export function resetContractState() {
  orders = {};
  idempotencyMap = {};
  bills = {};
  orderNumberSeq = 100;
  for (const key of Object.keys(tables)) {
    tables[key].status = 'AVAILABLE';
  }
}

export function getContractDbState() {
  return { orders, tables, bills, idempotencyMap };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ContractResponse {
  status: number;
  headers: Record<string, string>;
  data: any;
  raw: string;
}

export function handleContractRequest(
  pathname: string,
  method: string,
  headers: Headers | Record<string, string>,
  body: any
): ContractResponse {
  const normMethod = method.toUpperCase();

  // Route: GET /api/realtime
  if (pathname === '/api/realtime' && normMethod === 'GET') {
    return {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
      data: ': connected\n\n',
      raw: ': connected\n\n',
    };
  }

  // Route: GET /api/menu
  if (pathname === '/api/menu' && normMethod === 'GET') {
    const categories = [
      {
        id: 'cat-1',
        name: 'Hamburguesas',
        products: [products['prod-burger-classic']],
      },
      {
        id: 'cat-2',
        name: 'Acompañamientos',
        products: [products['prod-fries-rustic']],
      },
      {
        id: 'cat-3',
        name: 'Bebidas',
        products: [products['prod-drink-lemonade']],
      },
    ];
    const data = { success: true, categories, products: Object.values(products) };
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      data,
      raw: JSON.stringify(data),
    };
  }

  // Route: GET /api/tables
  if (pathname === '/api/tables' && normMethod === 'GET') {
    const tableList = Object.values(tables).map((t) => {
      const activeOrders = Object.values(orders)
        .filter((o) => o.table_id === t.id && o.status !== 'SERVED' && o.status !== 'CANCELLED')
        .map((o) => o.id);
      return { ...t, active_orders: activeOrders };
    });
    const data = { success: true, tables: tableList };
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      data,
      raw: JSON.stringify(data),
    };
  }

  // Route: POST /api/orders (Order Creation with Idempotency)
  if (pathname === '/api/orders' && normMethod === 'POST') {
    const { idempotency_key, table_id, items } = body || {};

    // Validation 1: Idempotency Key UUID
    if (!idempotency_key || !UUID_REGEX.test(idempotency_key)) {
      const err = { error: 'Invalid or missing idempotency_key UUID v4' };
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        data: err,
        raw: JSON.stringify(err),
      };
    }

    // Validation 2: Table ID
    if (!table_id || !tables[table_id]) {
      const err = { error: 'Restaurant table not found' };
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        data: err,
        raw: JSON.stringify(err),
      };
    }

    // Validation 3: Items non-empty
    if (!Array.isArray(items) || items.length === 0) {
      const err = { error: 'Order must contain at least one item' };
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        data: err,
        raw: JSON.stringify(err),
      };
    }

    // Check Idempotency Key Replay
    if (idempotencyMap[idempotency_key]) {
      const existingOrderId = idempotencyMap[idempotency_key];
      const existingOrder = orders[existingOrderId];
      const data = { success: true, order: existingOrder, replayed: true };
      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotent-Replay': 'true',
        },
        data,
        raw: JSON.stringify(data),
      };
    }

    // Validation 4: Validate items, quantities, and relational modifiers
    let orderTotal = 0;
    const processedItems: any[] = [];

    for (const item of items) {
      if (!item.product_id || !products[item.product_id]) {
        const err = { error: `Invalid product_id: ${item.product_id}` };
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          data: err,
          raw: JSON.stringify(err),
        };
      }

      if (typeof item.quantity !== 'number' || item.quantity <= 0 || !Number.isInteger(item.quantity)) {
        const err = { error: 'Item quantity must be a positive integer' };
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          data: err,
          raw: JSON.stringify(err),
        };
      }

      const product = products[item.product_id];
      let itemModifiersTotal = 0;
      const processedModifiers: any[] = [];

      const selectedModifierIds: string[] = Array.isArray(item.modifiers)
        ? item.modifiers.map((m: any) => (typeof m === 'string' ? m : m.modifier_id))
        : [];

      // Group cardinality verification
      for (const group of product.modifier_groups) {
        const groupModifierIds = new Set(group.modifiers.map((m: any) => m.id));
        const countInGroup = selectedModifierIds.filter((id) => groupModifierIds.has(id)).length;

        if (countInGroup < group.min_selection) {
          const err = {
            error: `Modifier group '${group.name}' requires minimum ${group.min_selection} selections`,
          };
          return {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
            data: err,
            raw: JSON.stringify(err),
          };
        }
        if (countInGroup > group.max_selection) {
          const err = {
            error: `Modifier group '${group.name}' permits maximum ${group.max_selection} selections`,
          };
          return {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
            data: err,
            raw: JSON.stringify(err),
          };
        }
      }

      // Modifier existence & price delta calculation
      for (const modId of selectedModifierIds) {
        let foundMod: any = null;
        for (const group of product.modifier_groups) {
          const m = group.modifiers.find((opt: any) => opt.id === modId);
          if (m) {
            foundMod = m;
            break;
          }
        }

        if (!foundMod) {
          const err = { error: `Modifier '${modId}' is not applicable to product '${product.name}'` };
          return {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
            data: err,
            raw: JSON.stringify(err),
          };
        }

        itemModifiersTotal += foundMod.price_delta;
        processedModifiers.push({
          modifier_id: foundMod.id,
          name: foundMod.name,
          price_delta: foundMod.price_delta,
          action_type: foundMod.action_type,
        });
      }

      const lineItemSubtotal = (product.base_price + itemModifiersTotal) * item.quantity;
      orderTotal += lineItemSubtotal;

      processedItems.push({
        id: crypto.randomUUID(),
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: product.base_price,
        modifiers: processedModifiers,
        subtotal: lineItemSubtotal,
      });
    }

    // Create atomic order
    const orderId = crypto.randomUUID();
    const orderRecord = {
      id: orderId,
      order_number: ++orderNumberSeq,
      table_id,
      idempotency_key,
      status: 'PENDING',
      items: processedItems,
      total_amount: orderTotal,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    orders[orderId] = orderRecord;
    idempotencyMap[idempotency_key] = orderId;
    tables[table_id].status = 'OCCUPIED';

    // Emit Realtime Event
    globalEventBus.emit('realtime', {
      type: 'ORDER_CREATED',
      payload: { order: orderRecord },
    });

    const data = { success: true, order: orderRecord, replayed: false };
    return {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
      data,
      raw: JSON.stringify(data),
    };
  }

  // Route: PATCH /api/orders/[id]/status (KDS Status Advance)
  const orderStatusMatch = pathname.match(/^\/api\/orders\/([^\/]+)\/status$/);
  if (orderStatusMatch && normMethod === 'PATCH') {
    const orderId = orderStatusMatch[1];
    const order = orders[orderId];

    if (!order) {
      const err = { error: 'Order not found' };
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        data: err,
        raw: JSON.stringify(err),
      };
    }

    const { status: newStatus } = body || {};
    const validStatuses = ['PENDING', 'IN_PREP', 'READY', 'SERVED', 'CANCELLED'];

    if (!validStatuses.includes(newStatus)) {
      const err = { error: `Invalid status: ${newStatus}` };
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        data: err,
        raw: JSON.stringify(err),
      };
    }

    const oldStatus = order.status;

    // Transition guards
    if (oldStatus === 'CANCELLED') {
      const err = { error: 'Cannot transition cancelled order' };
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        data: err,
        raw: JSON.stringify(err),
      };
    }

    if (oldStatus === 'PENDING' && newStatus === 'SERVED') {
      const err = { error: 'Illegal state transition: PENDING -> SERVED' };
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        data: err,
        raw: JSON.stringify(err),
      };
    }

    order.status = newStatus;
    order.updated_at = new Date().toISOString();

    globalEventBus.emit('realtime', {
      type: 'ORDER_STATUS_CHANGED',
      payload: {
        order_id: order.id,
        table_id: order.table_id,
        old_status: oldStatus,
        new_status: newStatus,
      },
    });

    const data = { success: true, order };
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      data,
      raw: JSON.stringify(data),
    };
  }

  // Route: GET /api/tables/[id]/bill (Cashier Table Aggregation)
  const tableBillMatch = pathname.match(/^\/api\/tables\/([^\/]+)\/bill$/);
  if (tableBillMatch && normMethod === 'GET') {
    const tableId = tableBillMatch[1];
    if (!tables[tableId]) {
      const err = { error: 'Table not found' };
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        data: err,
        raw: JSON.stringify(err),
      };
    }

    const tableOrders = Object.values(orders).filter(
      (o) => o.table_id === tableId && o.status !== 'CANCELLED' && !o.session_closed
    );

    if (tableOrders.length === 0) {
      const data = {
        success: true,
        bill: {
          table_id: tableId,
          subtotal: 0,
          tax: 0,
          tip: 0,
          total: 0,
          orders_count: 0,
          status: 'OPEN',
        },
      };
      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        data,
        raw: JSON.stringify(data),
      };
    }

    const subtotal = tableOrders.reduce((sum, o) => sum + o.total_amount, 0);
    const tax = Math.round(subtotal * 0.08); // 8% Impoconsumo
    const tip = Math.round(subtotal * 0.1); // 10% voluntary tip
    const total = subtotal + tax + tip;

    const bill = {
      id: bills[tableId]?.id || crypto.randomUUID(),
      table_id: tableId,
      subtotal,
      tax,
      tip,
      total,
      orders_count: tableOrders.length,
      orders: tableOrders,
      status: bills[tableId]?.status || 'OPEN',
    };
    bills[tableId] = bill;

    const data = { success: true, bill };
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      data,
      raw: JSON.stringify(data),
    };
  }

  // Route: POST /api/tables/[id]/pay (Payment Processing)
  const tablePayMatch = pathname.match(/^\/api\/tables\/([^\/]+)\/pay$/);
  if (tablePayMatch && normMethod === 'POST') {
    const tableId = tablePayMatch[1];
    const { payment_method, tendered_amount } = body || {};

    const validMethods = ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'SPLIT'];
    if (!validMethods.includes(payment_method)) {
      const err = { error: 'Invalid payment_method' };
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        data: err,
        raw: JSON.stringify(err),
      };
    }

    const bill = bills[tableId];
    if (!bill) {
      const err = { error: 'No active bill found for table' };
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        data: err,
        raw: JSON.stringify(err),
      };
    }

    if (bill.status === 'PAID') {
      const err = { error: 'Bill already paid' };
      return {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
        data: err,
        raw: JSON.stringify(err),
      };
    }

    if (payment_method === 'CASH' && tendered_amount !== undefined) {
      if (tendered_amount < bill.total) {
        const err = { error: 'Tendered amount is less than total bill' };
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          data: err,
          raw: JSON.stringify(err),
        };
      }
    }

    bill.status = 'PAID';
    bill.payment_method = payment_method;
    bill.paid_at = new Date().toISOString();

    const changeDue =
      payment_method === 'CASH' && tendered_amount ? Math.max(0, tendered_amount - bill.total) : 0;

    globalEventBus.emit('realtime', {
      type: 'PAYMENT_COMPLETED',
      payload: { table_id: tableId, bill_id: bill.id, amount: bill.total },
    });

    const data = { success: true, bill, change_due: changeDue };
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      data,
      raw: JSON.stringify(data),
    };
  }

  // Route: POST /api/tables/[id]/close (Table Settlement & Release)
  const tableCloseMatch = pathname.match(/^\/api\/tables\/([^\/]+)\/close$/);
  if (tableCloseMatch && normMethod === 'POST') {
    const tableId = tableCloseMatch[1];
    if (!tables[tableId]) {
      const err = { error: 'Table not found' };
      return {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
        data: err,
        raw: JSON.stringify(err),
      };
    }

    tables[tableId].status = 'AVAILABLE';
    delete bills[tableId];

    for (const order of Object.values(orders)) {
      if (order.table_id === tableId) {
        order.session_closed = true;
      }
    }

    globalEventBus.emit('realtime', {
      type: 'TABLE_STATUS_CHANGED',
      payload: { table_id: tableId, status: 'AVAILABLE' },
    });

    const data = { success: true, table_id: tableId, status: 'AVAILABLE' };
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      data,
      raw: JSON.stringify(data),
    };
  }

  // Default 404
  const notFound = { error: `Not found: ${pathname}` };
  return {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
    data: notFound,
    raw: JSON.stringify(notFound),
  };
}

export interface TestServerInstance {
  server: http.Server;
  baseUrl: string;
  close: () => Promise<void>;
  reset: () => void;
  eventBus: EventEmitter;
  getDbState: () => any;
}

export function createContractServer(port = 0): Promise<TestServerInstance> {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Idempotent-Replay');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    // Real-Time SSE Endpoint
    if (pathname === '/api/realtime' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });
      res.write(': connected\n\n');

      const onEvent = (eventData: any) => {
        try {
          res.write(`data: ${JSON.stringify(eventData)}\n\n`);
        } catch {
          // ignore write errors if connection dropped
        }
      };

      globalEventBus.on('realtime', onEvent);

      req.on('close', () => {
        globalEventBus.off('realtime', onEvent);
      });
      return;
    }

    let bodyData = '';
    req.on('data', (chunk) => {
      bodyData += chunk;
    });

    req.on('end', () => {
      let body: any = null;
      if (bodyData) {
        try {
          body = JSON.parse(bodyData);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
          return;
        }
      }

      const response = handleContractRequest(pathname, req.method || 'GET', req.headers as any, body);

      for (const [key, val] of Object.entries(response.headers)) {
        res.setHeader(key, val);
      }
      res.writeHead(response.status);
      res.end(response.raw);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const addr: any = server.address();
      const actualPort = addr ? addr.port : port;
      const baseUrl = `http://127.0.0.1:${actualPort}`;

      resolve({
        server,
        baseUrl,
        close: () =>
          new Promise((resClose) => {
            server.close(() => resClose());
          }),
        reset: resetContractState,
        eventBus: globalEventBus,
        getDbState: getContractDbState,
      });
    });
  });
}
