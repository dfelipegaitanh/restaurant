# Milestone 1: Database Engine & Relational Schema Implementation Plan

**Author:** teamwork_explorer (`m1_explorer_1` / `db-architect`)  
**Date:** 2026-11-06  
**Target Milestone:** M1 (Core Backend & Relational DB)  
**Authoritative References:** `.agents/teamwork/ORIGINAL_REQUEST.md`, `.agents/teamwork/PROJECT.md`, `.agents/roles/db-architect.md`, `.agents/teamwork/survey_miner_db/report.md`, `.agents/teamwork/survey_explorer_infra/report.md`.

---

## 1. Executive Summary & Runtime Diagnostic

A comprehensive audit of the workspace and host runtime established the following technical baseline:
- **Host Runtime:** Node.js `v22.11.0` (LTS) and npm `10.9.0` on Darwin x86_64.
- **Node 22 Built-in Capability:** `node --experimental-strip-types` is verified and functional, executing `.ts` scripts directly without transpilation or `ts-node`.
- **Infrastructure Constraint (Zero Docker / No Local PostgreSQL Daemon):** Docker Engine is not installed, and no native `psql` daemon is running. Relying solely on external Docker containers will stall the development and test pipeline.
- **Architectural Solution — Dual-Mode Database Engine:**
  1. **Primary Local / Test Mode:** `@electric-sql/pglite` (PostgreSQL 16 compiled to WebAssembly running natively inside Node.js 22). Zero daemons, zero external ports, 100% compliant with standard PostgreSQL 16 SQL, UUIDs, foreign keys, CHECK constraints, and ACID transactions.
  2. **Production / Remote Mode:** Standard PostgreSQL connection pool via `pg` (`node-postgres`) activated whenever `process.env.DATABASE_URL` is configured.
  3. **Auto-Boot Initialization:** On first server boot, the database wrapper checks if core tables exist. If missing, it automatically loads and executes `lib/db/schema.sql` and `lib/db/seed.sql`.

---

## 2. Deliverable 1: Exact `package.json` Setup

### 2.1 Canonical Configuration (`package.json`)
The following `package.json` provides the complete dependencies for Next.js, React, TypeScript, Tailwind CSS, `@electric-sql/pglite`, and `pg`:

```json
{
  "name": "restaurant-pos-kds",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "db:migrate": "node --experimental-strip-types scripts/seed-db.ts",
    "db:seed": "node --experimental-strip-types scripts/seed-db.ts",
    "test": "node --experimental-strip-types --test tests/**/*.test.ts",
    "test:idempotency": "node --experimental-strip-types --test tests/integration/idempotency.test.ts",
    "test:e2e": "node --experimental-strip-types scripts/verify-e2e.ts"
  },
  "dependencies": {
    "next": "^15.0.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@electric-sql/pglite": "^0.2.14",
    "pg": "^8.13.1"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^22.9.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/pg": "^8.11.10",
    "tailwindcss": "^3.4.14",
    "postcss": "^8.4.47",
    "autoprefixer": "^10.4.20"
  }
}
```

> **Fallback Note (Next.js 14 / React 18 LTS):**  
> If React 19 peer-dependency warnings occur during installation in restricted environments, the project can safely downgrade to `"next": "^14.2.18"`, `"react": "^18.3.1"`, `"react-dom": "^18.3.1"`, `"@types/react": "^18.3.12"`, `"@types/react-dom": "^18.3.1"`. The dual-mode database engine, DDL schema, and seed scripts remain 100% identical.

### 2.2 TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## 3. Deliverable 2: PostgreSQL 16 DDL Migration Script (`lib/db/schema.sql`)

This script implements:
1. **First-Class Relational Modifiers:** Prohibits free-text customizations ("sin cebolla", "extra queso"). All modifiers belong to relational tables (`modifier_groups`, `modifiers`, `product_modifier_groups`, `order_item_modifiers`).
2. **Table Sessions (`table_sessions`):** Tracks the customer dining cycle from occupation to settlement.
3. **Mandatory Atomic Idempotency:** Enforces `orders(idempotency_key UUID UNIQUE)` preventing duplicate tickets on network retries.
4. **PostgreSQL 16 Native UUID Generation:** Uses built-in `gen_random_uuid()` without requiring external extension binaries in WASM.

```sql
-- ============================================================================
-- RESTAURANT REALTIME POS & KDS — POSTGRESQL 16 DDL SCHEMA
-- File: lib/db/schema.sql
-- ============================================================================

-- 1. RESTAURANT TABLES (Mesas Físicas)
CREATE TABLE IF NOT EXISTS restaurant_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number INT NOT NULL UNIQUE CHECK (table_number > 0),
    capacity INT NOT NULL DEFAULT 4 CHECK (capacity > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'BILL_REQUESTED', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABLE SESSIONS (Ciclo de Estancia y Facturación de la Mesa)
CREATE TABLE IF NOT EXISTS table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'BILL_REQUESTED', 'CLOSED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

-- 3. MENU CATEGORIES (Categorías de Platos)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PRODUCTS (Platos, Bebidas y Entradas)
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

-- 5. MODIFIER GROUPS (Grupos Relacionales de Modificadores)
-- Enforces min/max cardinality rules (e.g., min: 1, max: 1 for required radio selection)
CREATE TABLE IF NOT EXISTS modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    min_selection INT NOT NULL DEFAULT 0 CHECK (min_selection >= 0),
    max_selection INT NOT NULL DEFAULT 1 CHECK (max_selection >= min_selection),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PRODUCT MODIFIER GROUPS (Asociación N:M Producto <-> Grupo)
CREATE TABLE IF NOT EXISTS product_modifier_groups (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    display_order INT NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, modifier_group_id)
);

-- 7. ATOMIC MODIFIERS (Opciones Específicas de Modificación)
-- Zero free-text: every option has a name, action_type, and price delta
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

-- 8. ORDERS (Comandas de Mesa con Idempotencia Obligatoria)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
    session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
    idempotency_key UUID NOT NULL UNIQUE, -- << REGLA 2: OBLIGATORIO Y ÚNICO
    order_number SERIAL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'IN_PREP', 'READY', 'SERVED', 'CANCELLED')),
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. ORDER ITEMS (Líneas de Comanda con Snapshot de Precio)
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

-- 10. ORDER ITEM MODIFIERS (Modificadores Seleccionados por Línea)
-- Zero free-text fallback: strict relation between order item and modifier
CREATE TABLE IF NOT EXISTS order_item_modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    modifier_id UUID NOT NULL REFERENCES modifiers(id) ON DELETE RESTRICT,
    unit_price_delta DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price_delta >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (order_item_id, modifier_id)
);

-- 11. BILLS (Cuentas y Cobro de Mesas)
CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
    session_id UUID REFERENCES table_sessions(id) ON DELETE SET NULL,
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
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    PRIMARY KEY (bill_id, order_id)
);

-- 13. PAYMENTS (Transacciones Detalladas de Pago)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
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
```

---

## 4. Deliverable 3: Seed Data Script (`lib/db/seed.sql` & `scripts/seed-db.ts`)

### 4.1 SQL Seed Script (`lib/db/seed.sql`)
Using deterministic UUIDs allows automated tests and client views to refer to known tables, products, and modifiers reliably.

```sql
-- ============================================================================
-- RESTAURANT POS & KDS SEED DATA
-- File: lib/db/seed.sql
-- ============================================================================

-- 1. SEED 8 RESTAURANT TABLES
INSERT INTO restaurant_tables (id, table_number, capacity, status) VALUES
('10000000-0000-0000-0000-000000000001', 1, 2, 'AVAILABLE'),
('10000000-0000-0000-0000-000000000002', 2, 2, 'AVAILABLE'),
('10000000-0000-0000-0000-000000000003', 3, 4, 'AVAILABLE'),
('10000000-0000-0000-0000-000000000004', 4, 4, 'AVAILABLE'),
('10000000-0000-0000-0000-000000000005', 5, 4, 'AVAILABLE'),
('10000000-0000-0000-0000-000000000006', 6, 6, 'AVAILABLE'),
('10000000-0000-0000-0000-000000000007', 7, 6, 'AVAILABLE'),
('10000000-0000-0000-0000-000000000008', 8, 8, 'AVAILABLE')
ON CONFLICT (table_number) DO UPDATE SET capacity = EXCLUDED.capacity;

-- 2. SEED MENU CATEGORIES
INSERT INTO categories (id, name, display_order, is_active) VALUES
('c0000000-0000-0000-0000-000000000001', 'Hamburguesas Artesanales', 1, true),
('c0000000-0000-0000-0000-000000000002', 'Pizzas al Horno', 2, true),
('c0000000-0000-0000-0000-000000000003', 'Acompañamientos y Entradas', 3, true),
('c0000000-0000-0000-0000-000000000004', 'Bebidas y Cervezas', 4, true)
ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order;

-- 3. SEED MODIFIER GROUPS
INSERT INTO modifier_groups (id, name, min_selection, max_selection) VALUES
('g0000000-0000-0000-0000-000000000001', 'Término de la Carne', 1, 1),
('g0000000-0000-0000-0000-000000000002', 'Remover Ingredientes', 0, 5),
('g0000000-0000-0000-0000-000000000003', 'Adiciones y Extras', 0, 4),
('g0000000-0000-0000-0000-000000000004', 'Tipo de Masa Pizza', 1, 1),
('g0000000-0000-0000-0000-000000000005', 'Acompañamiento Combo', 0, 1)
ON CONFLICT (id) DO NOTHING;

-- 4. SEED ATOMIC MODIFIERS
-- Group 1: Término de la Carne
INSERT INTO modifiers (id, modifier_group_id, name, price_delta, action_type, display_order) VALUES
('m0000000-0000-0000-0000-000000000101', 'g0000000-0000-0000-0000-000000000001', 'Término Azul', 0.00, 'OPTION', 1),
('m0000000-0000-0000-0000-000000000102', 'g0000000-0000-0000-0000-000000000001', 'Término Medio', 0.00, 'OPTION', 2),
('m0000000-0000-0000-0000-000000000103', 'g0000000-0000-0000-0000-000000000001', 'Tres Cuartos', 0.00, 'OPTION', 3),
('m0000000-0000-0000-0000-000000000104', 'g0000000-0000-0000-0000-000000000001', 'Bien Asado', 0.00, 'OPTION', 4),

-- Group 2: Remover Ingredientes
('m0000000-0000-0000-0000-000000000201', 'g0000000-0000-0000-0000-000000000002', 'Sin Cebolla', 0.00, 'NO', 1),
('m0000000-0000-0000-0000-000000000202', 'g0000000-0000-0000-0000-000000000002', 'Sin Tomate', 0.00, 'NO', 2),
('m0000000-0000-0000-0000-000000000203', 'g0000000-0000-0000-0000-000000000002', 'Sin Pepinillos', 0.00, 'NO', 3),
('m0000000-0000-0000-0000-000000000204', 'g0000000-0000-0000-0000-000000000002', 'Sin Lechuga', 0.00, 'NO', 4),
('m0000000-0000-0000-0000-000000000205', 'g0000000-0000-0000-0000-000000000002', 'Sin Salsa de la Casa', 0.00, 'NO', 5),

-- Group 3: Adiciones y Extras
('m0000000-0000-0000-0000-000000000301', 'g0000000-0000-0000-0000-000000000003', 'Extra Queso Cheddar', 3500.00, 'EXTRA', 1),
('m0000000-0000-0000-0000-000000000302', 'g0000000-0000-0000-0000-000000000003', 'Extra Tocineta Ahumada', 4500.00, 'EXTRA', 2),
('m0000000-0000-0000-0000-000000000303', 'g0000000-0000-0000-0000-000000000003', 'Huevo Frito', 2000.00, 'EXTRA', 3),
('m0000000-0000-0000-0000-000000000304', 'g0000000-0000-0000-0000-000000000003', 'Tapa de Guacamole', 3000.00, 'EXTRA', 4),
('m0000000-0000-0000-0000-000000000305', 'g0000000-0000-0000-0000-000000000003', 'Doble Carne 150g', 8000.00, 'EXTRA', 5),

-- Group 4: Tipo de Masa Pizza
('m0000000-0000-0000-0000-000000000401', 'g0000000-0000-0000-0000-000000000004', 'Masa Tradicional', 0.00, 'OPTION', 1),
('m0000000-0000-0000-0000-000000000402', 'g0000000-0000-0000-0000-000000000004', 'Masa Delgada Crocante', 0.00, 'OPTION', 2),
('m0000000-0000-0000-0000-000000000403', 'g0000000-0000-0000-0000-000000000004', 'Borde Relleno de Queso', 5000.00, 'OPTION', 3),

-- Group 5: Acompañamiento Combo
('m0000000-0000-0000-0000-000000000501', 'g0000000-0000-0000-0000-000000000005', 'Papas Francesas', 4000.00, 'OPTION', 1),
('m0000000-0000-0000-0000-000000000502', 'g0000000-0000-0000-0000-000000000005', 'Aros de Cebolla', 5000.00, 'OPTION', 2),
('m0000000-0000-0000-0000-000000000503', 'g0000000-0000-0000-0000-000000000005', 'Papas Rústicas con Romero', 4500.00, 'OPTION', 3)
ON CONFLICT (id) DO NOTHING;

-- 5. SEED PRODUCTS
INSERT INTO products (id, category_id, name, description, base_price, image_url, is_available) VALUES
-- Hamburguesas
('p0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Hamburguesa Clásica Bogotana', '150g de res Angus, lechuga, tomate, cebolla caramelizada y salsa tártara de la casa.', 24000.00, '/images/burger-clasica.jpg', true),
('p0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Hamburguesa Doble Carne y Queso', 'Doble porción de 150g, doble queso cheddar fundido, tocineta ahumada y BBQ artesanal.', 32000.00, '/images/burger-doble.jpg', true),
('p0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Hamburguesa Monster BBQ', 'Carne madurada, cebolla crisp, queso gouda y salsa ahumada de jack daniel''s.', 36000.00, '/images/burger-monster.jpg', true),

-- Pizzas
('p0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'Pizza Margarita Artesanal', 'Salsa de tomates San Marzano, mozzarella fresca di bufala, albahaca fresca y aceite de oliva virgen.', 28000.00, '/images/pizza-margarita.jpg', true),
('p0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'Pizza Pepperoni & Miel Picante', 'Pepperoni madurado artesanal, queso fior di latte y glaseado final de miel con chile habanero.', 34000.00, '/images/pizza-pepperoni.jpg', true),
('p0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'Pizza Cuatro Quesos', 'Combinación balanceada de mozzarella, queso azul artesanal, gouda madurado y parmesano.', 33000.00, '/images/pizza-quesos.jpg', true),

-- Acompañamientos
('p0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 'Papas Rústicas con Romero', 'Papas cortadas a mano, sazonadas con flor de sal marina y romero fresco con dip de ajo.', 12000.00, '/images/papas-rusticas.jpg', true),
('p0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000003', 'Alitas BBQ x8', 'Alitas crujientes bañadas en reducción de BBQ casera, servidas con bastones de apio.', 22000.00, '/images/alitas.jpg', true),
('p0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000003', 'Nachos con Guacamole y Cheddar', 'Totopos de maíz nixtamalizado, queso cheddar fundido y guacamole recién hecho.', 18000.00, '/images/nachos.jpg', true),

-- Bebidas
('p0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000004', 'Cerveza Artesanal IPA (330ml)', 'Lúpulo aromático cítrico, notas florales y amargor balanceado (6.5% ABV).', 14000.00, '/images/cerveza-ipa.jpg', true),
('p0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000004', 'Cerveza Club Colombia Dorada', 'Lager rubia tradicional de malta seleccionada (330ml botella).', 8000.00, '/images/club-colombia.jpg', true),
('p0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000004', 'Limonada de Coco Natural', 'Zumo de limón natural batido con crema de coco cremosa y hielo frappé.', 10000.00, '/images/limonada-coco.jpg', true),
('p0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000004', 'Gaseosa Colombiana 400ml', 'Refrescante gaseosa tradicional fría.', 5000.00, '/images/colombiana.jpg', true)
ON CONFLICT (id) DO NOTHING;

-- 6. LINK PRODUCTS TO MODIFIER GROUPS
INSERT INTO product_modifier_groups (product_id, modifier_group_id, display_order) VALUES
-- Hamburguesas: Término (1), Remover (2), Extras (3), Combo (4)
('p0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000001', 1),
('p0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000002', 2),
('p0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000003', 3),
('p0000000-0000-0000-0000-000000000001', 'g0000000-0000-0000-0000-000000000005', 4),

('p0000000-0000-0000-0000-000000000002', 'g0000000-0000-0000-0000-000000000001', 1),
('p0000000-0000-0000-0000-000000000002', 'g0000000-0000-0000-0000-000000000002', 2),
('p0000000-0000-0000-0000-000000000002', 'g0000000-0000-0000-0000-000000000003', 3),
('p0000000-0000-0000-0000-000000000002', 'g0000000-0000-0000-0000-000000000005', 4),

('p0000000-0000-0000-0000-000000000003', 'g0000000-0000-0000-0000-000000000001', 1),
('p0000000-0000-0000-0000-000000000003', 'g0000000-0000-0000-0000-000000000002', 2),
('p0000000-0000-0000-0000-000000000003', 'g0000000-0000-0000-0000-000000000003', 3),
('p0000000-0000-0000-0000-000000000003', 'g0000000-0000-0000-0000-000000000005', 4),

-- Pizzas: Masa (1), Extras (2)
('p0000000-0000-0000-0000-000000000004', 'g0000000-0000-0000-0000-000000000004', 1),
('p0000000-0000-0000-0000-000000000004', 'g0000000-0000-0000-0000-000000000003', 2),

('p0000000-0000-0000-0000-000000000005', 'g0000000-0000-0000-0000-000000000004', 1),
('p0000000-0000-0000-0000-000000000005', 'g0000000-0000-0000-0000-000000000003', 2),

('p0000000-0000-0000-0000-000000000006', 'g0000000-0000-0000-0000-000000000004', 1),
('p0000000-0000-0000-0000-000000000006', 'g0000000-0000-0000-0000-000000000003', 2)
ON CONFLICT (product_id, modifier_group_id) DO NOTHING;
```

### 4.2 Seed Execution Runner (`scripts/seed-db.ts`)
```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../lib/db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSeed() {
  console.log('🚀 [DB] Starting Database Migration & Seed Runner...');
  const startTime = Date.now();

  const db = await getDb();

  const schemaPath = path.resolve(__dirname, '../lib/db/schema.sql');
  const seedPath = path.resolve(__dirname, '../lib/db/seed.sql');

  console.log(`📄 [DB] Reading schema DDL from: ${schemaPath}`);
  const schemaSql = await fs.readFile(schemaPath, 'utf-8');

  console.log(`🌱 [DB] Reading seed data from: ${seedPath}`);
  const seedSql = await fs.readFile(seedPath, 'utf-8');

  // Execute in sequence
  console.log('⚙️ [DB] Applying DDL migration...');
  await db.query(schemaSql);
  console.log('✅ [DB] DDL migration applied successfully.');

  console.log('⚙️ [DB] Inserting seed data...');
  await db.query(seedSql);
  console.log('✅ [DB] Seed data applied successfully.');

  // Validate seeded row counts
  const tableCount = await db.query('SELECT COUNT(*) as count FROM restaurant_tables');
  const catCount = await db.query('SELECT COUNT(*) as count FROM categories');
  const prodCount = await db.query('SELECT COUNT(*) as count FROM products');
  const groupCount = await db.query('SELECT COUNT(*) as count FROM modifier_groups');
  const modCount = await db.query('SELECT COUNT(*) as count FROM modifiers');
  const linkCount = await db.query('SELECT COUNT(*) as count FROM product_modifier_groups');

  console.log('\n📊 Database Summary Verification:');
  console.table([
    { Entity: 'restaurant_tables', Count: Number(tableCount.rows[0].count), Expected: 8 },
    { Entity: 'categories', Count: Number(catCount.rows[0].count), Expected: 4 },
    { Entity: 'products', Count: Number(prodCount.rows[0].count), Expected: 13 },
    { Entity: 'modifier_groups', Count: Number(groupCount.rows[0].count), Expected: 5 },
    { Entity: 'modifiers', Count: Number(modCount.rows[0].count), Expected: 20 },
    { Entity: 'product_modifier_groups', Count: Number(linkCount.rows[0].count), Expected: 18 }
  ]);

  const elapsed = Date.now() - startTime;
  console.log(`✨ [DB] Completed migration & seed in ${elapsed}ms.`);
}

runSeed().catch((err) => {
  console.error('❌ [DB] Error executing seed:', err);
  process.exit(1);
});
```

---

## 5. Deliverable 4: Dual-Mode DB Client Wrapper

### 5.1 Dual-Mode Adapter (`lib/db/index.ts`)
Key capabilities:
- **Global Singleton:** Shields against connection exhaustion or multiple PGlite WASM memory spaces during Next.js App Router hot reloads.
- **Auto-Boot Initialization:** Uses an atomic promise lock to check if `restaurant_tables` exists, executing `schema.sql` and `seed.sql` on first access.
- **Unified Interface (`DbClient`):** Enables seamless swapping between PGlite and standard `pg` Pool without modifying a single application query.

```typescript
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  transaction<T>(callback: (tx: DbClient) => Promise<T>): Promise<T>;
}

declare global {
  // eslint-disable-next-line no-var
  var __dbClientInstance: DbClient | undefined;
  // eslint-disable-next-line no-var
  var __dbInitPromise: Promise<void> | undefined;
}

let cachedClient: DbClient | undefined = globalThis.__dbClientInstance;

async function createDbClient(): Promise<DbClient> {
  const databaseUrl = process.env.DATABASE_URL;

  // Mode B: Standard PostgreSQL via 'pg' Pool
  if (databaseUrl && !databaseUrl.startsWith('pglite://') && !databaseUrl.startsWith('memory://')) {
    console.log('[DB] Connecting to PostgreSQL via standard pg.Pool...');
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    const client: DbClient = {
      async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
        const res = await pool.query(sql, params);
        return {
          rows: res.rows as T[],
          rowCount: res.rowCount ?? res.rows.length,
        };
      },
      async transaction<T>(callback: (tx: DbClient) => Promise<T>): Promise<T> {
        const conn = await pool.connect();
        try {
          await conn.query('BEGIN');
          const txClient: DbClient = {
            async query<R = any>(sql: string, params?: any[]): Promise<QueryResult<R>> {
              const res = await conn.query(sql, params);
              return {
                rows: res.rows as R[],
                rowCount: res.rowCount ?? res.rows.length,
              };
            },
            async transaction(): Promise<never> {
              throw new Error('Nested transactions are not supported');
            },
          };
          const result = await callback(txClient);
          await conn.query('COMMIT');
          return result;
        } catch (err) {
          await conn.query('ROLLBACK');
          throw err;
        } finally {
          conn.release();
        }
      },
    };

    return client;
  }

  // Mode A: Embedded WebAssembly PostgreSQL 16 via @electric-sql/pglite
  console.log('[DB] Initializing embedded WebAssembly PostgreSQL 16 (@electric-sql/pglite)...');
  const { PGlite } = await import('@electric-sql/pglite');
  
  // Data directory persistence for dev, or memory for ephemeral runs
  const dataDir = process.env.PGLITE_DATA_DIR || './data/pglite_db';
  const pglite = new PGlite(dataDir);

  const client: DbClient = {
    async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
      const res = await pglite.query<T>(sql, params);
      return {
        rows: res.rows,
        rowCount: res.affectedRows ?? res.rows.length,
      };
    },
    async transaction<T>(callback: (tx: DbClient) => Promise<T>): Promise<T> {
      return await pglite.transaction(async (tx) => {
        const txClient: DbClient = {
          async query<R = any>(sql: string, params?: any[]): Promise<QueryResult<R>> {
            const res = await tx.query<R>(sql, params);
            return {
              rows: res.rows,
              rowCount: res.affectedRows ?? res.rows.length,
            };
          },
          async transaction(): Promise<never> {
            throw new Error('Nested transactions are not supported');
          },
        };
        return await callback(txClient);
      });
    },
  };

  return client;
}

// Automatic Schema & Seed Initialization on First Boot
async function ensureInitialized(client: DbClient): Promise<void> {
  if (globalThis.__dbInitPromise) {
    return globalThis.__dbInitPromise;
  }

  globalThis.__dbInitPromise = (async () => {
    try {
      const check = await client.query<{ exists: boolean }>(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'restaurant_tables'
        ) as exists;
      `);

      if (!check.rows[0]?.exists) {
        console.log('⚡ [DB] First boot detected: table restaurant_tables missing.');
        console.log('⚡ [DB] Auto-initializing PostgreSQL 16 schema and seed data...');
        
        let basePath = process.cwd();
        let schemaPath = path.join(basePath, 'lib', 'db', 'schema.sql');
        let seedPath = path.join(basePath, 'lib', 'db', 'seed.sql');

        const schemaSql = await fs.readFile(schemaPath, 'utf-8');
        await client.query(schemaSql);

        const seedSql = await fs.readFile(seedPath, 'utf-8');
        await client.query(seedSql);

        console.log('✅ [DB] Auto-initialization completed successfully.');
      }
    } catch (err) {
      console.error('❌ [DB] Error during auto-initialization:', err);
      // Reset promise to allow retry on subsequent requests
      globalThis.__dbInitPromise = undefined;
      throw err;
    }
  })();

  return globalThis.__dbInitPromise;
}

export async function getDb(): Promise<DbClient> {
  if (!cachedClient) {
    cachedClient = await createDbClient();
    globalThis.__dbClientInstance = cachedClient;
  }
  await ensureInitialized(cachedClient);
  return cachedClient;
}
```

### 5.2 High-Performance Query Repository (`lib/db/queries.ts`)
Provides typed queries covering tables, menu, atomic order creation, and billing:

```typescript
import { getDb, DbClient } from './index.js';

export interface TableRow {
  id: string;
  table_number: number;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'BILL_REQUESTED' | 'CLOSED';
  active_session_id?: string | null;
}

export interface MenuItemWithModifiers {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  is_available: boolean;
  modifier_groups: {
    id: string;
    name: string;
    min_selection: number;
    max_selection: number;
    modifiers: {
      id: string;
      name: string;
      price_delta: number;
      action_type: 'NO' | 'EXTRA' | 'OPTION' | 'SUBSTITUTE';
    }[];
  }[];
}

export interface CreateOrderParams {
  table_id: string;
  idempotency_key: string;
  items: {
    product_id: string;
    quantity: number;
    modifier_ids: string[];
  }[];
}

export interface CreatedOrderResult {
  order_id: string;
  order_number: number;
  table_id: string;
  status: string;
  total_amount: number;
  replayed: boolean;
  items: any[];
}

// 1. Get All Tables with Current Session Info
export async function getTables(): Promise<TableRow[]> {
  const db = await getDb();
  const res = await db.query<TableRow>(`
    SELECT 
      t.id,
      t.table_number,
      t.capacity,
      t.status,
      s.id as active_session_id
    FROM restaurant_tables t
    LEFT JOIN table_sessions s 
      ON s.table_id = t.id AND s.status = 'ACTIVE'
    ORDER BY t.table_number ASC;
  `);
  return res.rows;
}

// 2. Get Full Menu with Relational Modifier Groups & Modifiers
export async function getMenu(): Promise<{ categories: any[]; products: MenuItemWithModifiers[] }> {
  const db = await getDb();

  const catRes = await db.query(`
    SELECT id, name, display_order 
    FROM categories 
    WHERE is_active = true 
    ORDER BY display_order ASC;
  `);

  const prodRes = await db.query<MenuItemWithModifiers>(`
    SELECT 
      p.id,
      p.category_id,
      c.name as category_name,
      p.name,
      p.description,
      p.base_price::float as base_price,
      p.image_url,
      p.is_available,
      COALESCE(
        json_agg(
          json_build_object(
            'id', mg.id,
            'name', mg.name,
            'min_selection', mg.min_selection,
            'max_selection', mg.max_selection,
            'modifiers', COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', m.id,
                    'name', m.name,
                    'price_delta', m.price_delta::float,
                    'action_type', m.action_type
                  ) ORDER BY m.display_order ASC
                )
                FROM modifiers m 
                WHERE m.modifier_group_id = mg.id AND m.is_available = true
              ),
              '[]'::json
            )
          ) ORDER BY pmg.display_order ASC
        ) FILTER (WHERE mg.id IS NOT NULL),
        '[]'::json
      ) as modifier_groups
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN product_modifier_groups pmg ON pmg.product_id = p.id
    LEFT JOIN modifier_groups mg ON mg.id = pmg.modifier_group_id
    WHERE p.is_available = true
    GROUP BY p.id, c.name, c.display_order
    ORDER BY c.display_order ASC, p.name ASC;
  `);

  return {
    categories: catRes.rows,
    products: prodRes.rows,
  };
}

// 3. Atomic Order Ingestion with Idempotency Conflict Resolution
export async function createOrderAtomic(params: CreateOrderParams): Promise<CreatedOrderResult> {
  const db = await getDb();

  return await db.transaction(async (tx) => {
    // A. Check for existing order by idempotency_key
    const existing = await tx.query(`
      SELECT id, order_number, table_id, status, total_amount::float as total_amount
      FROM orders
      WHERE idempotency_key = $1;
    `, [params.idempotency_key]);

    if (existing.rows.length > 0) {
      const order = existing.rows[0];
      const items = await tx.query(`
        SELECT 
          oi.id, oi.product_id, p.name as product_name, oi.quantity, 
          oi.unit_price::float as unit_price, oi.subtotal::float as subtotal
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = $1;
      `, [order.id]);

      return {
        order_id: order.id,
        order_number: order.order_number,
        table_id: order.table_id,
        status: order.status,
        total_amount: order.total_amount,
        replayed: true,
        items: items.rows,
      };
    }

    // B. Get or Create Active Table Session
    let sessionId: string;
    const sessionRes = await tx.query(`
      SELECT id FROM table_sessions 
      WHERE table_id = $1 AND status = 'ACTIVE' 
      LIMIT 1;
    `, [params.table_id]);

    if (sessionRes.rows.length > 0) {
      sessionId = sessionRes.rows[0].id;
    } else {
      const newSession = await tx.query(`
        INSERT INTO table_sessions (table_id, status)
        VALUES ($1, 'ACTIVE')
        RETURNING id;
      `, [params.table_id]);
      sessionId = newSession.rows[0].id;
    }

    // C. Create Order Header
    const orderInsert = await tx.query(`
      INSERT INTO orders (table_id, session_id, idempotency_key, status, total_amount)
      VALUES ($1, $2, $3, 'PENDING', 0)
      RETURNING id, order_number;
    `, [params.table_id, sessionId, params.idempotency_key]);

    const orderId = orderInsert.rows[0].id;
    const orderNumber = orderInsert.rows[0].order_number;

    let calculatedTotal = 0;
    const insertedItems: any[] = [];

    // D. Insert Items and Item Modifiers
    for (const item of params.items) {
      const prodRes = await tx.query(`
        SELECT name, base_price::float as base_price 
        FROM products 
        WHERE id = $1;
      `, [item.product_id]);

      if (prodRes.rows.length === 0) {
        throw new Error(`Product ${item.product_id} not found`);
      }

      const basePrice = prodRes.rows[0].base_price;
      let modifiersDeltaTotal = 0;
      const verifiedModifiers: { id: string; price_delta: number }[] = [];

      // Validate each relational modifier
      if (item.modifier_ids && item.modifier_ids.length > 0) {
        for (const modId of item.modifier_ids) {
          const modRes = await tx.query(`
            SELECT m.id, m.price_delta::float as price_delta
            FROM modifiers m
            JOIN product_modifier_groups pmg ON pmg.modifier_group_id = m.modifier_group_id
            WHERE m.id = $1 AND pmg.product_id = $2;
          `, [modId, item.product_id]);

          if (modRes.rows.length === 0) {
            throw new Error(`Modifier ${modId} does not belong to product ${item.product_id}`);
          }

          const delta = modRes.rows[0].price_delta;
          modifiersDeltaTotal += delta;
          verifiedModifiers.push({ id: modId, price_delta: delta });
        }
      }

      const unitPrice = basePrice + modifiersDeltaTotal;
      const subtotal = unitPrice * item.quantity;
      calculatedTotal += subtotal;

      const itemInsert = await tx.query(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal, status)
        VALUES ($1, $2, $3, $4, $5, 'PENDING')
        RETURNING id;
      `, [orderId, item.product_id, item.quantity, unitPrice, subtotal]);

      const orderItemId = itemInsert.rows[0].id;

      for (const mod of verifiedModifiers) {
        await tx.query(`
          INSERT INTO order_item_modifiers (order_item_id, modifier_id, unit_price_delta)
          VALUES ($1, $2, $3);
        `, [orderItemId, mod.id, mod.price_delta]);
      }

      insertedItems.push({
        id: orderItemId,
        product_id: item.product_id,
        product_name: prodRes.rows[0].name,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal: subtotal,
      });
    }

    // E. Update Order Total & Table Status
    await tx.query(`
      UPDATE orders SET total_amount = $1 WHERE id = $2;
    `, [calculatedTotal, orderId]);

    await tx.query(`
      UPDATE restaurant_tables SET status = 'OCCUPIED', updated_at = NOW() WHERE id = $1;
    `, [params.table_id]);

    return {
      order_id: orderId,
      order_number: orderNumber,
      table_id: params.table_id,
      status: 'PENDING',
      total_amount: calculatedTotal,
      replayed: false,
      items: insertedItems,
    };
  });
}

// 4. Update Order Status (for Kitchen KDS)
export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const db = await getDb();
  await db.query(`
    UPDATE orders 
    SET status = $1, updated_at = NOW() 
    WHERE id = $2;
  `, [status, orderId]);
}
```

---

## 6. Implementation Action Plan for Milestone 1

| Step | Action | Target Path | Responsibility | Verification Command |
|---|---|---|---|---|
| **1** | Initialize `package.json` & `tsconfig.json` | `/package.json`, `/tsconfig.json` | `sentinel` / `db-architect` | `npm install` |
| **2** | Write PostgreSQL 16 DDL migration | `/lib/db/schema.sql` | `db-architect` | Verify file presence & syntax |
| **3** | Write Deterministic Seed SQL | `/lib/db/seed.sql` | `db-architect` | Verify 8 tables, 4 categories, 13 products |
| **4** | Implement Dual-Mode DB Client | `/lib/db/index.ts` | `db-architect` | Type check against `DbClient` interface |
| **5** | Implement High-Performance Queries | `/lib/db/queries.ts` | `db-architect` | Type check against `domain.ts` types |
| **6** | Implement Standalone Seed Runner | `/scripts/seed-db.ts` | `db-architect` | `node --experimental-strip-types scripts/seed-db.ts` (exits 0) |

---

## 7. Conclusion

This implementation plan resolves the Docker environmental absence by leveraging `@electric-sql/pglite` WASM with native PostgreSQL 16 semantics, while retaining complete compatibility with standard PostgreSQL. All four deliverables are defined with copy-ready, production-grade code.
