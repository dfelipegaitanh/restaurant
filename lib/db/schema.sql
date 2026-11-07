-- ============================================================================
-- RESTAURANT REALTIME POS & KDS — POSTGRESQL 16 DDL SCHEMA
-- File: lib/db/schema.sql
-- ============================================================================

-- 1. RESTAURANT TABLES (Mesas Físicas)
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    table_number INT NOT NULL UNIQUE CHECK (table_number > 0),
    capacity INT NOT NULL DEFAULT 4 CHECK (capacity > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'BILL_REQUESTED', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABLE SESSIONS (Ciclo de Estancia y Facturación de la Mesa)
CREATE TABLE IF NOT EXISTS table_sessions (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    table_id VARCHAR(100) NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'BILL_REQUESTED', 'CLOSED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 3. MENU CATEGORIES (Categorías de Platos)
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PRODUCTS (Platos, Bebidas y Entradas)
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    category_id VARCHAR(100) NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2) NOT NULL CHECK (base_price >= 0),
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. MODIFIER GROUPS (Grupos Relacionales de Modificadores)
CREATE TABLE IF NOT EXISTS modifier_groups (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(100) NOT NULL,
    min_selection INT NOT NULL DEFAULT 0 CHECK (min_selection >= 0),
    max_selection INT NOT NULL DEFAULT 1 CHECK (max_selection >= min_selection),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PRODUCT MODIFIER GROUPS (Asociación N:M Producto <-> Grupo)
CREATE TABLE IF NOT EXISTS product_modifier_groups (
    product_id VARCHAR(100) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    modifier_group_id VARCHAR(100) NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    display_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, modifier_group_id)
);

-- 7. ATOMIC MODIFIERS (Opciones Específicas de Modificación)
CREATE TABLE IF NOT EXISTS modifiers (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    modifier_group_id VARCHAR(100) NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price_delta DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (price_delta >= 0),
    action_type VARCHAR(20) NOT NULL
        CHECK (action_type IN ('NO', 'EXTRA', 'OPTION', 'SUBSTITUTE')),
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. ORDERS (Comandas de Mesa con Idempotencia Obligatoria)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    table_id VARCHAR(100) NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
    session_id VARCHAR(100) REFERENCES table_sessions(id) ON DELETE SET NULL,
    idempotency_key UUID NOT NULL UNIQUE,
    order_number SERIAL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'IN_PREP', 'READY', 'SERVED', 'CANCELLED')),
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. ORDER ITEMS (Líneas de Comanda con Snapshot de Precio)
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_id VARCHAR(100) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(100) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal DECIMAL(10, 2) NOT NULL CHECK (subtotal >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'IN_PREP', 'READY', 'SERVED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. ORDER ITEM MODIFIERS (Modificadores Seleccionados por Línea)
CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_item_id VARCHAR(100) NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_id VARCHAR(100) NOT NULL REFERENCES modifiers(id) ON DELETE RESTRICT,
    unit_price_delta DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price_delta >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (order_item_id, modifier_id)
);

-- 11. BILLS (Cuentas y Cobro de Mesas)
CREATE TABLE IF NOT EXISTS bills (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    table_id VARCHAR(100) NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
    session_id VARCHAR(100) REFERENCES table_sessions(id) ON DELETE SET NULL,
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

-- 12. BILL ORDERS (Asociación N:M Factura <-> Comandas)
CREATE TABLE IF NOT EXISTS bill_orders (
    bill_id VARCHAR(100) NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    order_id VARCHAR(100) NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    PRIMARY KEY (bill_id, order_id)
);

-- 13. PAYMENTS (Transacciones Detalladas de Pago)
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    bill_id VARCHAR(100) NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    tendered_amount DECIMAL(10, 2),
    change_due DECIMAL(10, 2),
    reference_code VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PERFORMANCE & INTEGRITY INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_item_id ON order_item_modifiers(order_item_id);
CREATE INDEX IF NOT EXISTS idx_modifiers_group_id ON modifiers(modifier_group_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table_id ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_bills_table_id ON bills(table_id);
