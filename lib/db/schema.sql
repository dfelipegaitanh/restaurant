-- ============================================================================
-- RESTAURANT FAST-CASUAL POS & KDS — POSTGRESQL 16 SCHEMA
-- File: lib/db/schema.sql
-- ============================================================================

-- 1. MENU CATEGORIES (Categorías de Platos)
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. PRODUCTS (Platos de Autor en CAD)
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(100) PRIMARY KEY,
    category_id VARCHAR(50) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2) NOT NULL CHECK (base_price >= 0),
    image_url TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ORDERS (Comandas de Kiosko con Idempotencia y Número de Turno)
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    order_number SERIAL,
    idempotency_key UUID NOT NULL UNIQUE,
    customer_name VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'IN_PREP', 'READY', 'SERVED', 'CANCELLED')),
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ORDER ITEMS (Líneas de la Comanda con Snapshot de Precio)
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

-- Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
