-- ============================================================================
-- RESTAURANT POS & KDS SEED DATA
-- File: lib/db/seed.sql
-- ============================================================================

-- 1. SEED 8 RESTAURANT TABLES
INSERT INTO restaurant_tables (id, table_number, capacity, status) VALUES
('table-1', 1, 4, 'AVAILABLE'),
('table-2', 2, 2, 'AVAILABLE'),
('table-3', 3, 4, 'AVAILABLE'),
('table-4', 4, 6, 'AVAILABLE'),
('table-5', 5, 4, 'AVAILABLE'),
('table-6', 6, 4, 'AVAILABLE'),
('table-7', 7, 2, 'AVAILABLE'),
('table-8', 8, 8, 'AVAILABLE')
ON CONFLICT (table_number) DO UPDATE SET 
  capacity = EXCLUDED.capacity,
  status = EXCLUDED.status;

-- 2. SEED MENU CATEGORIES
INSERT INTO categories (id, name, display_order, is_active) VALUES
('cat-1', 'Hamburguesas', 1, true),
('cat-2', 'Acompañamientos', 2, true),
('cat-3', 'Bebidas', 3, true),
('cat-4', 'Pizzas al Horno', 4, true)
ON CONFLICT (name) DO UPDATE SET 
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- 3. SEED MODIFIER GROUPS
INSERT INTO modifier_groups (id, name, min_selection, max_selection) VALUES
('mod-group-doneness', 'Término de la Carne', 1, 1),
('mod-group-toppings', 'Adiciones & Ajustes', 0, 3),
('mod-group-sauces', 'Salsas Artesanales', 0, 2),
('mod-group-crust', 'Tipo de Masa Pizza', 1, 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  min_selection = EXCLUDED.min_selection,
  max_selection = EXCLUDED.max_selection;

-- 4. SEED ATOMIC MODIFIERS
-- Group 1: Término de la Carne
INSERT INTO modifiers (id, modifier_group_id, name, price_delta, action_type, display_order) VALUES
('mod-doneness-med', 'mod-group-doneness', 'Término Medio', 0.00, 'OPTION', 1),
('mod-doneness-34', 'mod-group-doneness', 'Tres Cuartos', 0.00, 'OPTION', 2),
('mod-doneness-well', 'mod-group-doneness', 'Bien Asada', 0.00, 'OPTION', 3),
('mod-doneness-blue', 'mod-group-doneness', 'Término Azul', 0.00, 'OPTION', 4),

-- Group 2: Adiciones & Ajustes
('mod-extra-bacon', 'mod-group-toppings', 'Extra Tocineta Ahumada', 4500.00, 'EXTRA', 1),
('mod-extra-cheese', 'mod-group-toppings', 'Doble Queso Cheddar', 3500.00, 'EXTRA', 2),
('mod-no-onion', 'mod-group-toppings', 'Sin Cebolla', 0.00, 'NO', 3),
('mod-no-tomato', 'mod-group-toppings', 'Sin Tomate', 0.00, 'NO', 4),
('mod-no-pickles', 'mod-group-toppings', 'Sin Pepinillos', 0.00, 'NO', 5),

-- Group 3: Salsas Artesanales
('mod-sauce-garlic', 'mod-group-sauces', 'Salsa de Ajo Casera', 1500.00, 'OPTION', 1),
('mod-sauce-bbq', 'mod-group-sauces', 'BBQ Ahumada', 1500.00, 'OPTION', 2),
('mod-sauce-tartar', 'mod-group-sauces', 'Salsa Tártara Artesanal', 1500.00, 'OPTION', 3),

-- Group 4: Tipo de Masa Pizza
('mod-crust-traditional', 'mod-group-crust', 'Masa Tradicional', 0.00, 'OPTION', 1),
('mod-crust-thin', 'mod-group-crust', 'Masa Delgada Crocante', 0.00, 'OPTION', 2),
('mod-crust-cheese', 'mod-group-crust', 'Borde Relleno de Queso', 5000.00, 'OPTION', 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_delta = EXCLUDED.price_delta,
  action_type = EXCLUDED.action_type,
  display_order = EXCLUDED.display_order;

-- 5. SEED PRODUCTS
INSERT INTO products (id, category_id, name, description, base_price, image_url, is_available) VALUES
('prod-burger-classic', 'cat-1', 'Hamburguesa Clásica Bogotana', '150g de res Angus, lechuga, tomate, cebolla caramelizada y salsa tártara de la casa.', 24000.00, '/images/burger.jpg', true),
('prod-burger-double', 'cat-1', 'Hamburguesa Doble Carne y Queso', 'Doble porción de 150g, doble queso cheddar fundido, tocineta ahumada y BBQ artesanal.', 32000.00, '/images/burger-double.jpg', true),
('prod-fries-rustic', 'cat-2', 'Papas Rústicas', 'Papas cortadas a mano, sazonadas con flor de sal marina y romero fresco con dip casero.', 8000.00, '/images/fries.jpg', true),
('prod-drink-lemonade', 'cat-3', 'Limonada Natural', 'Zumo de limón natural batido con hielo frappé refrescante.', 7000.00, '/images/lemonade.jpg', true),
('prod-pizza-margarita', 'cat-4', 'Pizza Margarita Artesanal', 'Salsa de tomates San Marzano, mozzarella fresca di bufala, albahaca fresca y aceite de oliva virgen.', 28000.00, '/images/pizza.jpg', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  base_price = EXCLUDED.base_price,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available;

-- 6. LINK PRODUCTS TO MODIFIER GROUPS
INSERT INTO product_modifier_groups (product_id, modifier_group_id, display_order) VALUES
('prod-burger-classic', 'mod-group-doneness', 1),
('prod-burger-classic', 'mod-group-toppings', 2),
('prod-burger-double', 'mod-group-doneness', 1),
('prod-burger-double', 'mod-group-toppings', 2),
('prod-fries-rustic', 'mod-group-sauces', 1),
('prod-pizza-margarita', 'mod-group-crust', 1)
ON CONFLICT (product_id, modifier_group_id) DO UPDATE SET
  display_order = EXCLUDED.display_order;
