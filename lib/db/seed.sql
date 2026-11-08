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
('bogotana-clasica', 'burgers', 'La Bogotana Clásica 2.0', '160g carne Angus certificada, queso doble crema fundido, lechuga romana, tomate milano confitado, cebolla grillé caramelizada en cerveza negra y salsa tártara de la casa en pan brioche tostado.', 16.50, '/images/products/bogotana-clasica.jpeg', true),
('chicharronera-bbq', 'burgers', 'La Chicharronera BBQ Panela', '160g Angus, panceta de cerdo crocante bañada en reducción de panela y naranja agria, queso mozzarella gratinado, lechuga crocante y emulsión de ajo asado.', 19.50, '/images/products/chicharronera-bbq.jpeg', true),
('paisa-montanera', 'burgers', 'La Paisa Montañera Suprema', '160g carne, trozos de chicharrón crujiente, tajadas de plátano maduro al horno con mantequilla, huevo frito criollo de yema tierna, queso costeño rallado y hogao campesino caliente.', 20.50, '/images/products/paisa-montanera.jpeg', true),
('costena-smash', 'burgers', 'La Costeña Smash & Suero', 'Doble carne smashed (2x90g), lámina gruesa de queso costeño asada al fuego, tocineta ahumada al manzano, cebolla frita crocante y abundante suero costeño al cebollino.', 18.50, '/images/products/costena-smash.jpeg', true),
('guayaba-queso-azul', 'burgers', 'La Guayaba & Queso Azul Smash', 'Doble carne smashed (2x90g), reducción espesa de bocadillo veleño con ají suave, queso azul suave fundido, tocineta crocante y rúgula fresca.', 19.00, '/images/products/guayaba-queso-azul.jpeg', true),
('pollo-crispy-andina', 'burgers', 'La Pollo Crispy Andina', 'Suprema de pechuga frita extra crocante marinada en suero y especias, coleslaw criollo con toques de manzana verde, mayonesa de cilantro y pepinillos agridulces.', 17.50, '/images/products/pollo-crispy-andina.jpeg', true),
('llanera-mamona', 'burgers', 'La Llanera Ahumada al Barril', '160g carne Angus combinada con lascas de ternera a la llanera ahumada 6 horas al barril, queso siete cueros fundido, yuca crocante en hilos, chimichurri de cilantro cimarrón y mayonesa de ají dulce.', 21.00, '/images/products/llanera-mamona.jpeg', true),
('valluna-aborrajada', 'burgers', 'La Valluna Aborrajada', '160g carne Angus a la parrilla coronada con medallón de plátano maduro aborrajado relleno de queso doble crema y bocadillo, tocineta crocante, rúgula fresca y emulsión cítrica de lulo del Valle.', 19.50, '/images/products/valluna-aborrajada.jpeg', true),
('santandereana-cabro', 'burgers', 'La Santandereana Arrecha', 'Doble carne smashed (2x90g) en costra de pepitoria crocante, queso paipa madurado fundido, cebolla ocañera encurtida en vinagre de caña, tocineta ahumada y tártara brava santandereana.', 20.00, '/images/products/santandereana-cabro.jpeg', true),
('rolita-ajiaco', 'burgers', 'La Rolita Ajiaco & Alcaparras', '160g carne Angus jugosa, pechuga desmechada en crema espesa de guascas, lámina de aguacate Hass, alcaparras fritas crocantes, chips de papa criolla dorada y queso campesino asado.', 18.50, '/images/products/rolita-ajiaco.jpeg', true),
('pacifico-encocada', 'burgers', 'La Pacífico Surf & Turf Encocada', '160g carne Angus a la plancha coronada con camarones tigre salteados en salsa encocada de leche de coco, poleo y cimarrón, queso mozzarella gratinado, crocante de plátano verde y alioli de limón.', 22.50, '/images/products/pacifico-encocada.jpeg', true),

-- Perros Calientes
('callejero-monumental', 'dogs', 'El Callejero Monumental', 'Salchicha americana ahumada jumbo en pan brioche largo, queso mozzarella gratinado, tocineta en cubos, lluvia dorada de papa fosforito, salsa tártara, salsa de piña calada y salsa rosada clásica.', 12.50, '/images/products/callejero-monumental.jpeg', true),
('choricero-santarrosano', 'dogs', 'El Choricero Santarrosano', 'Chorizo santarrosano artesanal abierto a la parrilla, guacamole rústico con limón mandarino, pico de gallo campesino, papa ripio crocante y suero costeño.', 14.00, '/images/products/choricero-santarrosano.jpeg', true),
('sucio-desmechado', 'dogs', 'El Sucio Desmechado', 'Salchicha americana, sobrebarriga braseada desmechada en hogao criollo tradicional, doble queso gratinado, huevos de codorniz cocidos al punto y salsa casera de ajo y cilantro.', 15.50, '/images/products/sucio-desmechado.jpeg', true),
('maicito-gratinado', 'dogs', 'El Maicito Gratinado Dog', 'Salchicha americana envuelta en tocineta a la plancha, baño espeso de maíz dulce tierno en crema de queso, papa fosforito y queso costeño rallado por encima.', 14.50, '/images/products/maicito-gratinado.jpeg', true),
('butifarra-queso', 'dogs', 'El Butifarra & Queso Dog', 'Salchicha americana combinada con trozos salteados de butifarra de Soledad marinada en limón, cebolla morada curtida, papa ripio y salsa verde de aguacate.', 14.50, '/images/products/butifarra-queso.jpeg', true),
('perro-llanero', 'dogs', 'El Llanero al Barril Dog', 'Salchicha ahumada al barril en pan brioche, cubierta con pecho de res desmechado a la brasa, queso siete cueros estirado, lluvia de yuca ripio crocante y guasacaca cremosa de aguacate y cilantro.', 15.50, '/images/products/perro-llanero.jpeg', true),
('perro-valluno', 'dogs', 'El Chuleta & Lulo Valluno Dog', 'Salchicha americana con tiras crocantes de chuleta valluna apanada, queso doble crema gratinado, ensalada fresca de repollo morado, salsa agria de lulo y lluvia de platanitos verdes triturados.', 15.00, '/images/products/perro-valluno.jpeg', true),
('perro-pastuso', 'dogs', 'El Pastuso Hornado & Ají de Maní', 'Salchicha alemana grillada con cerdo hornado nariñense desmechado, mote tierno salteado, queso paipa gratinado, papa fosforito y salsa cremosa de ají de maní artesanal.', 16.00, '/images/products/perro-pastuso.jpeg', true),
('perro-tolimense', 'dogs', 'El Lechona Tolimense Crunchy Dog', 'Salchicha jumbo ahumada coronada con lechona tolimense horneada, trozos de galleta de cuero de cerdo ultra crocante, arveja amarilla, queso mozzarella y hogao de cebolla larga.', 16.50, '/images/products/perro-tolimense.jpeg', true),
('perro-cartagenero', 'dogs', 'El Cartagenero Camarón & Coco Dog', 'Salchicha a la parrilla en pan brioche de coco, camarones al ajillo y leche de coco, queso costeño asado en cubitos, cebolla morada encurtida en limón, papa ripio y suero picante de ají chombo.', 17.50, '/images/products/perro-cartagenero.jpeg', true),

-- Salchipapas
('salchipapa-clasica', 'salchipapas', 'Salchipapa Clásica Bogotana', 'Cama generosa de papas rústicas en cascos, salchicha americana en rodajas doradas, queso mozzarella fundido derretido al soplete y lluvia de salsa tártara y piña.', 13.50, '/images/products/salchipapa-clasica.jpeg', true),
('salchipapa-bestia', 'salchipapas', 'Salchipapa La Bestia Costeña', 'Papas rústicas, salchicha americana, butifarra frita en cuartos, sobrebarriga desmechada al hogao, cubos dorados de queso costeño frito y chorro generoso de suero.', 19.50, '/images/products/salchipapa-bestia.jpeg', true),
('salchipapa-chicharronera', 'salchipapas', 'Salchipapa Chicharronera Criolla', 'Base mixta de papa criolla frita y papas rústicas, 150g de trozos de chicharrón tostado con limón, salchicha ahumada, hogao caliente y queso campesino gratinado.', 21.50, '/images/products/salchipapa-chicharronera.jpeg', true),
('salchipapa-maicitos', 'salchipapas', 'Salchipapa Maicitos & Bacon Lovers', 'Papas rústicas, salchicha americana dorada, tocineta crocante picada, maíz dulce salteado a la mantequilla y baño de salsa de cuatro quesos fundidos.', 17.50, '/images/products/salchipapa-maicitos.jpeg', true),
('salchipapa-guajira', 'salchipapas', 'Salchipapa Picante Guajira', 'Papas rústicas, salchicha tipo kielbasa picante, chicharrón, guacamole criollo, ají dulce ahumado, cebolla morada encurtida y queso costeño.', 18.50, '/images/products/salchipapa-guajira.jpeg', true),
('salchipapa-llanera', 'salchipapas', 'Salchipapa Llanera al Barril', 'Cama de papas rústicas y bastones de yuca frita, salchicha ahumada, bondiola y punta de anca al barril en cubos, queso siete cueros fundido y baño de guasacaca llanera.', 22.00, '🥩', true),
('salchipapa-tolimense', 'salchipapas', 'Salchipapa Lechona & Cuero Tostado', 'Papas criollas doradas y papas rústicas, salchicha americana, abundante lechona tolimense desmechada, chicharrón de cuero soplado crocante, mozzarella derretido y ají de tomate de árbol.', 21.00, '🐖', true),
('salchipapa-paisa', 'salchipapas', 'Salchipapa Bandeja Montañera', 'Papas en cascos, chorizo antioqueño y morcilla crocante en rodajas, chicharrón carnudo, maduritos calados, carne molida criolla, dos huevos de codorniz, aguacate y hogao caliente.', 22.50, '🍳', true),
('salchipapa-marina', 'salchipapas', 'Salchipapa Mar & Tierra del Pacífico', 'Papas rústicas y chips de plátano verde, salchicha ahumada, camarones y anillos de calamar al ajillo en salsa encocada cremosa, queso gratinado y limón mandarino.', 24.00, '🦑', true),
('salchipapa-trufada', 'salchipapas', 'Salchipapa Rolita Trufada & Paipa', 'Mezcla de papa nativa sabanera y papa criolla, salchicha artesanal de ternera, hongos portobello salteados al ajillo, queso paipa rallado fundido, tocineta ahumada y mayonesa de trufa negra y cilantro.', 20.50, '🍄', true),

-- Acompañamientos
('papas-rusticas', 'sides', 'Papas Rústicas de la Casa (Estándar)', 'Papas cortadas en gajos con cáscara, doble cocción crocante, sazonadas con flor de sal marina y páprika ahumada.', 5.50, '/images/products/papas-rusticas.jpeg', true),
('empanaditas-criollas', 'sides', 'Empanaditas Criollas de Carne (4 uds)', 'Empanadas de maíz crocante rellenas de carne desmechada y papa criolla, servidas con ají bogotano y limón.', 7.50, '/images/products/empanaditas-criollas.jpeg', true),
('yucas-crocantes', 'sides', 'Yucas Crocantes con Suero', 'Bastones de yuca frita dorada con costra crujiente, acompañados de suero costeño artesanal.', 6.50, '/images/products/yucas-crocantes.jpeg', true),
('arepitas-choclo', 'sides', 'Arepitas de Choclo con Queso (2 uds)', 'Masa dulce de maíz choclo tierno a la plancha con mantequilla y lámina generosa de queso campesino fresco.', 6.00, '/images/products/arepitas-choclo.jpeg', true),

-- Bebidas Artesanales
('limonada-coco', 'drinks', 'Limonada de Coco & Cardamomo', 'Frappé espeso de leche de coco natural, zumo de lima recién exprimido y toque aromático de cardamomo.', 6.50, '/images/products/limonada-coco.jpeg', true),
('limonada-panela', 'drinks', 'Limonada de Panela & Maracuyá', 'Refresco frío de panela orgánica macerada con pulpa fresca de maracuyá ácido.', 5.50, '/images/products/limonada-panela.jpeg', true),
('soda-lulo', 'drinks', 'Soda Artesanal de Lulo & Hierbabuena', 'Pulpa de lulo colombiano batida con soda con gas, hojas de hierbabuena y hielo.', 5.50, '/images/products/soda-lulo.jpeg', true),
('malta-leche-condensada', 'drinks', 'Malta Fría con Leche Condensada', 'Botella de Pony Malta helada servida con hilo espeso de leche condensada al estilo tradicional.', 4.50, '/images/products/malta-leche-condensada.jpeg', true),
('gaseosa-postobon', 'drinks', 'Gaseosa Colombiana / Postobón 355ml', 'Colombiana, Manzana Postobón o Bretaña helada.', 3.50, '/images/products/gaseosa-postobon.jpeg', true),

-- Postres Rápidos
('oblea-septima', 'desserts', 'Oblea Deconstruida de la Séptima', 'Capas de barquillo crocante intercaladas con arequipe de leche entero, queso costeño rallado y dulce casero de moras silvestres.', 6.50, '/images/products/oblea-septima.jpeg', true),
('churros-criollos', 'desserts', 'Churros Criollos con Salsa de Café', '4 bastones de churro recién fritos azucarados con canela, servidos con dip de caramelo y café de origen colombiano.', 6.00, '/images/products/churros-criollos.jpeg', true)
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  base_price = EXCLUDED.base_price,
  image_url = EXCLUDED.image_url,
  is_available = EXCLUDED.is_available;
