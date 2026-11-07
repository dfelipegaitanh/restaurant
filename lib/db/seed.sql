-- ============================================================================
-- RESTAURANT FAST-CASUAL SEED DATA (CAD)
-- File: lib/db/seed.sql
-- ============================================================================

-- 1. SEED CATEGORIES (Slugs limpios)
INSERT INTO categories (id, name, display_order, is_active) VALUES
('burgers', 'Hamburguesas Criollas', 1, true),
('dogs', 'Perros Calientes Salvajes', 2, true),
('salchipapas', 'Salchipapas Monumentales', 3, true),
('sides', 'Acompañamientos & Entradas', 4, true),
('drinks', 'Bebidas Artesanales', 5, true),
('desserts', 'Postres Rápidos', 6, true)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

-- 2. SEED PRODUCTS (Precios en CAD)
INSERT INTO products (id, category_id, name, description, base_price, image_url, is_available) VALUES
-- Hamburguesas
('bogotana-clasica', 'burgers', 'La Bogotana Clásica 2.0', '160g carne Angus certificada, queso doble crema fundido, lechuga romana, tomate milano confitado, cebolla grillé caramelizada en cerveza negra y salsa tártara de la casa en pan brioche tostado.', 16.50, '🍔', true),
('chicharronera-bbq', 'burgers', 'La Chicharronera BBQ Panela', '160g Angus, panceta de cerdo crocante bañada en reducción de panela y naranja agria, queso mozzarella gratinado, lechuga crocante y emulsión de ajo asado.', 19.50, '🥓', true),
('paisa-montanera', 'burgers', 'La Paisa Montañera Suprema', '160g carne, trozos de chicharrón crujiente, tajadas de plátano maduro al horno con mantequilla, huevo frito criollo de yema tierna, queso costeño rallado y hogao campesino caliente.', 20.50, '🍳', true),
('costena-smash', 'burgers', 'La Costeña Smash & Suero', 'Doble carne smashed (2x90g), lámina gruesa de queso costeño asada al fuego, tocineta ahumada al manzano, cebolla frita crocante y abundante suero costeño al cebollino.', 18.50, '🧀', true),
('guayaba-queso-azul', 'burgers', 'La Guayaba & Queso Azul Smash', 'Doble carne smashed (2x90g), reducción espesa de bocadillo veleño con ají suave, queso azul suave fundido, tocineta crocante y rúgula fresca.', 19.00, '🫐', true),
('pollo-crispy-andina', 'burgers', 'La Pollo Crispy Andina', 'Suprema de pechuga frita extra crocante marinada en suero y especias, coleslaw criollo con toques de manzana verde, mayonesa de cilantro y pepinillos agridulces.', 17.50, '🍗', true),

-- Perros Calientes
('callejero-monumental', 'dogs', 'El Callejero Monumental', 'Salchicha americana ahumada jumbo en pan brioche largo, queso mozzarella gratinado, tocineta en cubos, lluvia dorada de papa fosforito, salsa tártara, salsa de piña calada y salsa rosada clásica.', 12.50, '🌭', true),
('choricero-santarrosano', 'dogs', 'El Choricero Santarrosano', 'Chorizo santarrosano artesanal abierto a la parrilla, guacamole rústico con limón mandarino, pico de gallo campesino, papa ripio crocante y suero costeño.', 14.00, '🔥', true),
('sucio-desmechado', 'dogs', 'El Sucio Desmechado', 'Salchicha americana, sobrebarriga braseada desmechada en hogao criollo tradicional, doble queso gratinado, huevos de codorniz cocidos al punto y salsa casera de ajo y cilantro.', 15.50, '🥩', true),
('maicito-gratinado', 'dogs', 'El Maicito Gratinado Dog', 'Salchicha americana envuelta en tocineta a la plancha, baño espeso de maíz dulce tierno en crema de queso, papa fosforito y queso costeño rallado por encima.', 14.50, '🌽', true),
('butifarra-queso', 'dogs', 'El Butifarra & Queso Dog', 'Salchicha americana combinada con trozos salteados de butifarra de Soledad marinada en limón, cebolla morada curtida, papa ripio y salsa verde de aguacate.', 14.50, '🌭', true),

-- Salchipapas
('salchipapa-clasica', 'salchipapas', 'Salchipapa Clásica Bogotana', 'Cama generosa de papas rústicas en cascos, salchicha americana en rodajas doradas, queso mozzarella fundido derretido al soplete y lluvia de salsa tártara y piña.', 13.50, '🍟', true),
('salchipapa-bestia', 'salchipapas', 'Salchipapa La Bestia Costeña', 'Papas rústicas, salchicha americana, butifarra frita en cuartos, sobrebarriga desmechada al hogao, cubos dorados de queso costeño frito y chorro generoso de suero.', 19.50, '👑', true),
('salchipapa-chicharronera', 'salchipapas', 'Salchipapa Chicharronera Criolla', 'Base mixta de papa criolla frita y papas rústicas, 150g de trozos de chicharrón tostado con limón, salchicha ahumada, hogao caliente y queso campesino gratinado.', 21.50, '🥓', true),
('salchipapa-maicitos', 'salchipapas', 'Salchipapa Maicitos & Bacon Lovers', 'Papas rústicas, salchicha americana dorada, tocineta crocante picada, maíz dulce salteado a la mantequilla y baño de salsa de cuatro quesos fundidos.', 17.50, '🧀', true),
('salchipapa-guajira', 'salchipapas', 'Salchipapa Picante Guajira', 'Papas rústicas, salchicha tipo kielbasa picante, chicharrón, guacamole criollo, ají dulce ahumado, cebolla morada encurtida y queso costeño.', 18.50, '🌶️', true),

-- Acompañamientos
('papas-rusticas', 'sides', 'Papas Rústicas de la Casa (Estándar)', 'Papas cortadas en gajos con cáscara, doble cocción crocante, sazonadas con flor de sal marina y páprika ahumada.', 5.50, '🍟', true),
('empanaditas-criollas', 'sides', 'Empanaditas Criollas de Carne (4 uds)', 'Empanadas de maíz crocante rellenas de carne desmechada y papa criolla, servidas con ají bogotano y limón.', 7.50, '🥟', true),
('yucas-crocantes', 'sides', 'Yucas Crocantes con Suero', 'Bastones de yuca frita dorada con costra crujiente, acompañados de suero costeño artesanal.', 6.50, '🥢', true),
('arepitas-choclo', 'sides', 'Arepitas de Choclo con Queso (2 uds)', 'Masa dulce de maíz choclo tierno a la plancha con mantequilla y lámina generosa de queso campesino fresco.', 6.00, '🫓', true),

-- Bebidas Artesanales
('limonada-coco', 'drinks', 'Limonada de Coco & Cardamomo', 'Frappé espeso de leche de coco natural, zumo de lima recién exprimido y toque aromático de cardamomo.', 6.50, '🥥', true),
('limonada-panela', 'drinks', 'Limonada de Panela & Maracuyá', 'Refresco frío de panela orgánica macerada con pulpa fresca de maracuyá ácido.', 5.50, '🍹', true),
('soda-lulo', 'drinks', 'Soda Artesanal de Lulo & Hierbabuena', 'Pulpa de lulo colombiano batida con soda con gas, hojas de hierbabuena y hielo.', 5.50, '🍃', true),
('malta-leche-condensada', 'drinks', 'Malta Fría con Leche Condensada', 'Botella de Pony Malta helada servida con hilo espeso de leche condensada al estilo tradicional.', 4.50, '🥛', true),
('gaseosa-postobon', 'drinks', 'Gaseosa Colombiana / Postobón 355ml', 'Colombiana, Manzana Postobón o Bretaña helada.', 3.50, '🥤', true),

-- Postres Rápidos
('oblea-septima', 'desserts', 'Oblea Deconstruida de la Séptima', 'Capas de barquillo crocante intercaladas con arequipe de leche entero, queso costeño rallado y dulce casero de moras silvestres.', 6.50, '🧇', true),
('churros-criollos', 'desserts', 'Churros Criollos con Salsa de Café', '4 bastones de churro recién fritos azucarados con canela, servidos con dip de caramelo y café de origen colombiano.', 6.00, '🍩', true)
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  base_price = EXCLUDED.base_price,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available;
