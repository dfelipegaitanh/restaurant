import { getDb } from '../lib/db/index.ts';

async function seed() {
  console.log('⚡ Seeding Colombian Street Food Fast-Casual Catalog (CAD)...');
  const db = await getDb();

  // 1. Categories
  const categories = [
    { id: 'burgers', name: 'Hamburguesas Criollas', display_order: 1 },
    { id: 'dogs', name: 'Perros Calientes Salvajes', display_order: 2 },
    { id: 'salchipapas', name: 'Salchipapas Monumentales', display_order: 3 },
    { id: 'sides', name: 'Acompañamientos & Entradas', display_order: 4 },
    { id: 'drinks', name: 'Bebidas Artesanales', display_order: 5 },
    { id: 'desserts', name: 'Postres Rápidos', display_order: 6 },
  ];

  for (const cat of categories) {
    await db.query(
      `INSERT INTO categories (id, name, display_order, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (id) DO UPDATE SET 
         name = EXCLUDED.name,
         display_order = EXCLUDED.display_order,
         is_active = true`,
      [cat.id, cat.name, cat.display_order]
    );
  }

  // 2. Products
  const products = [
    // 🍔 Hamburguesas Criollas
    {
      id: 'bogotana-clasica',
      category_id: 'burgers',
      name: 'La Bogotana Clásica 2.0',
      description: '160g carne Angus certificada, queso doble crema fundido, lechuga romana, tomate milano confitado, cebolla grillé caramelizada en cerveza negra y salsa tártara de la casa en pan brioche tostado.',
      base_price: 16.50,
      image_url: '/images/products/bogotana-clasica.jpeg',
    },
    {
      id: 'chicharronera-bbq',
      category_id: 'burgers',
      name: 'La Chicharronera BBQ Panela',
      description: '160g Angus, panceta de cerdo crocante bañada en reducción de panela y naranja agria, queso mozzarella gratinado, lechuga crocante y emulsión de ajo asado.',
      base_price: 19.50,
      image_url: '/images/products/chicharronera-bbq.jpeg',
    },
    {
      id: 'paisa-montanera',
      category_id: 'burgers',
      name: 'La Paisa Montañera Suprema',
      description: '160g carne, trozos de chicharrón crujiente, tajadas de plátano maduro al horno con mantequilla, huevo frito criollo de yema tierna, queso costeño rallado y hogao campesino caliente.',
      base_price: 20.50,
      image_url: '/images/products/paisa-montanera.jpeg',
    },
    {
      id: 'costena-smash',
      category_id: 'burgers',
      name: 'La Costeña Smash & Suero',
      description: 'Doble carne smashed (2x90g), lámina gruesa de queso costeño asada al fuego, tocineta ahumada al manzano, cebolla frita crocante y abundante suero costeño al cebollino.',
      base_price: 18.50,
      image_url: '/images/products/costena-smash.jpeg',
    },
    {
      id: 'guayaba-queso-azul',
      category_id: 'burgers',
      name: 'La Guayaba & Queso Azul Smash',
      description: 'Doble carne smashed (2x90g), reducción espesa de bocadillo veleño con ají suave, queso azul suave fundido, tocineta crocante y rúgula fresca.',
      base_price: 19.00,
      image_url: '/images/products/guayaba-queso-azul.jpeg',
    },
    {
      id: 'pollo-crispy-andina',
      category_id: 'burgers',
      name: 'La Pollo Crispy Andina',
      description: 'Suprema de pechuga frita extra crocante marinada en suero y especias, coleslaw criollo con toques de manzana verde, mayonesa de cilantro y pepinillos agridulces.',
      base_price: 17.50,
      image_url: '/images/products/pollo-crispy-andina.jpeg',
    },
    {
      id: 'llanera-mamona',
      category_id: 'burgers',
      name: 'La Llanera Ahumada al Barril',
      description: '160g carne Angus combinada con lascas de ternera a la llanera ahumada 6 horas al barril, queso siete cueros fundido, yuca crocante en hilos, chimichurri de cilantro cimarrón y mayonesa de ají dulce.',
      base_price: 21.00,
      image_url: '/images/products/llanera-mamona.jpeg',
    },
    {
      id: 'valluna-aborrajada',
      category_id: 'burgers',
      name: 'La Valluna Aborrajada',
      description: '160g carne Angus a la parrilla coronada con medallón de plátano maduro aborrajado relleno de queso doble crema y bocadillo, tocineta crocante, rúgula fresca y emulsión cítrica de lulo del Valle.',
      base_price: 19.50,
      image_url: '/images/products/valluna-aborrajada.jpeg',
    },
    {
      id: 'santandereana-cabro',
      category_id: 'burgers',
      name: 'La Santandereana Arrecha',
      description: 'Doble carne smashed (2x90g) en costra de pepitoria crocante, queso paipa madurado fundido, cebolla ocañera encurtida en vinagre de caña, tocineta ahumada y tártara brava santandereana.',
      base_price: 20.00,
      image_url: '/images/products/santandereana-cabro.jpeg',
    },
    {
      id: 'rolita-ajiaco',
      category_id: 'burgers',
      name: 'La Rolita Ajiaco & Alcaparras',
      description: '160g carne Angus jugosa, pechuga desmechada en crema espesa de guascas, lámina de aguacate Hass, alcaparras fritas crocantes, chips de papa criolla dorada y queso campesino asado.',
      base_price: 18.50,
      image_url: '/images/products/rolita-ajiaco.jpeg',
    },
    {
      id: 'pacifico-encocada',
      category_id: 'burgers',
      name: 'La Pacífico Surf & Turf Encocada',
      description: '160g carne Angus a la plancha coronada con camarones tigre salteados en salsa encocada de leche de coco, poleo y cimarrón, queso mozzarella gratinado, crocante de plátano verde y alioli de limón.',
      base_price: 22.50,
      image_url: '/images/products/pacifico-encocada.jpeg',
    },

    // 🌭 Perros Calientes Salvajes
    {
      id: 'callejero-monumental',
      category_id: 'dogs',
      name: 'El Callejero Monumental',
      description: 'Salchicha americana ahumada jumbo en pan brioche largo, queso mozzarella gratinado, tocineta en cubos, lluvia dorada de papa fosforito, salsa tártara, salsa de piña calada y salsa rosada clásica.',
      base_price: 12.50,
      image_url: '/images/products/callejero-monumental.jpeg',
    },
    {
      id: 'choricero-santarrosano',
      category_id: 'dogs',
      name: 'El Choricero Santarrosano',
      description: 'Chorizo santarrosano artesanal abierto a la parrilla, guacamole rústico con limón mandarino, pico de gallo campesino, papa ripio crocante y suero costeño.',
      base_price: 14.00,
      image_url: '/images/products/choricero-santarrosano.jpeg',
    },
    {
      id: 'sucio-desmechado',
      category_id: 'dogs',
      name: 'El Sucio Desmechado',
      description: 'Salchicha americana, sobrebarriga braseada desmechada en hogao criollo tradicional, doble queso gratinado, huevos de codorniz cocidos al punto y salsa casera de ajo y cilantro.',
      base_price: 15.50,
      image_url: '/images/products/sucio-desmechado.jpeg',
    },
    {
      id: 'maicito-gratinado',
      category_id: 'dogs',
      name: 'El Maicito Gratinado Dog',
      description: 'Salchicha americana envuelta en tocineta a la plancha, baño espeso de maíz dulce tierno en crema de queso, papa fosforito y queso costeño rallado por encima.',
      base_price: 14.50,
      image_url: '/images/products/maicito-gratinado.jpeg',
    },
    {
      id: 'butifarra-queso',
      category_id: 'dogs',
      name: 'El Butifarra & Queso Dog',
      description: 'Salchicha americana combinada con trozos salteados de butifarra de Soledad marinada en limón, cebolla morada curtida, papa ripio y salsa verde de aguacate.',
      base_price: 14.50,
      image_url: '/images/products/butifarra-queso.jpeg',
    },
    {
      id: 'perro-llanero',
      category_id: 'dogs',
      name: 'El Llanero al Barril Dog',
      description: 'Salchicha ahumada al barril en pan brioche, cubierta con pecho de res desmechado a la brasa, queso siete cueros estirado, lluvia de yuca ripio crocante y guasacaca cremosa de aguacate y cilantro.',
      base_price: 15.50,
      image_url: '/images/products/perro-llanero.jpeg',
    },
    {
      id: 'perro-valluno',
      category_id: 'dogs',
      name: 'El Chuleta & Lulo Valluno Dog',
      description: 'Salchicha americana con tiras crocantes de chuleta valluna apanada, queso doble crema gratinado, ensalada fresca de repollo morado, salsa agria de lulo y lluvia de platanitos verdes triturados.',
      base_price: 15.00,
      image_url: '/images/products/perro-valluno.jpeg',
    },
    {
      id: 'perro-pastuso',
      category_id: 'dogs',
      name: 'El Pastuso Hornado & Ají de Maní',
      description: 'Salchicha alemana grillada con cerdo hornado nariñense desmechado, mote tierno salteado, queso paipa gratinado, papa fosforito y salsa cremosa de ají de maní artesanal.',
      base_price: 16.00,
      image_url: '/images/products/perro-pastuso.jpeg',
    },
    {
      id: 'perro-tolimense',
      category_id: 'dogs',
      name: 'El Lechona Tolimense Crunchy Dog',
      description: 'Salchicha jumbo ahumada coronada con lechona tolimense horneada, trozos de galleta de cuero de cerdo ultra crocante, arveja amarilla, queso mozzarella y hogao de cebolla larga.',
      base_price: 16.50,
      image_url: '/images/products/perro-tolimense.jpeg',
    },
    {
      id: 'perro-cartagenero',
      category_id: 'dogs',
      name: 'El Cartagenero Camarón & Coco Dog',
      description: 'Salchicha a la parrilla en pan brioche de coco, camarones al ajillo y leche de coco, queso costeño asado en cubitos, cebolla morada encurtida en limón, papa ripio y suero picante de ají chombo.',
      base_price: 17.50,
      image_url: '/images/products/perro-cartagenero.jpeg',
    },

    // 🍟 Salchipapas Monumentales
    {
      id: 'salchipapa-clasica',
      category_id: 'salchipapas',
      name: 'Salchipapa Clásica Bogotana',
      description: 'Cama generosa de papas rústicas en cascos, salchicha americana en rodajas doradas, queso mozzarella fundido derretido al soplete y lluvia de salsa tártara y piña.',
      base_price: 13.50,
      image_url: '/images/products/salchipapa-clasica.jpeg',
    },
    {
      id: 'salchipapa-bestia',
      category_id: 'salchipapas',
      name: 'Salchipapa La Bestia Costeña',
      description: 'Papas rústicas, salchicha americana, butifarra frita en cuartos, sobrebarriga desmechada al hogao, cubos dorados de queso costeño frito y chorro generoso de suero.',
      base_price: 19.50,
      image_url: '/images/products/salchipapa-bestia.jpeg',
    },
    {
      id: 'salchipapa-chicharronera',
      category_id: 'salchipapas',
      name: 'Salchipapa Chicharronera Criolla',
      description: 'Base mixta de papa criolla frita y papas rústicas, 150g de trozos de chicharrón tostado con limón, salchicha ahumada, hogao caliente y queso campesino gratinado.',
      base_price: 21.50,
      image_url: '/images/products/salchipapa-chicharronera.jpeg',
    },
    {
      id: 'salchipapa-maicitos',
      category_id: 'salchipapas',
      name: 'Salchipapa Maicitos & Bacon Lovers',
      description: 'Papas rústicas, salchicha americana dorada, tocineta crocante picada, maíz dulce salteado a la mantequilla y baño de salsa de cuatro quesos fundidos.',
      base_price: 17.50,
      image_url: '/images/products/salchipapa-maicitos.jpeg',
    },
    {
      id: 'salchipapa-guajira',
      category_id: 'salchipapas',
      name: 'Salchipapa Picante Guajira',
      description: 'Papas rústicas, salchicha tipo kielbasa picante, chicharrón, guacamole criollo, ají dulce ahumado, cebolla morada encurtida y queso costeño.',
      base_price: 18.50,
      image_url: '/images/products/salchipapa-guajira.jpeg',
    },
    {
      id: 'salchipapa-llanera',
      category_id: 'salchipapas',
      name: 'Salchipapa Llanera al Barril',
      description: 'Cama de papas rústicas y bastones de yuca frita, salchicha ahumada, bondiola y punta de anca al barril en cubos, queso siete cueros fundido y baño de guasacaca llanera.',
      base_price: 22.00,
      image_url: '/images/products/salchipapa-llanera.jpeg',
    },
    {
      id: 'salchipapa-tolimense',
      category_id: 'salchipapas',
      name: 'Salchipapa Lechona & Cuero Tostado',
      description: 'Papas criollas doradas y papas rústicas, salchicha americana, abundante lechona tolimense desmechada, chicharrón de cuero soplado crocante, mozzarella derretido y ají de tomate de árbol.',
      base_price: 21.00,
      image_url: '/images/products/salchipapa-tolimense.jpeg',
    },
    {
      id: 'salchipapa-paisa',
      category_id: 'salchipapas',
      name: 'Salchipapa Bandeja Montañera',
      description: 'Papas en cascos, chorizo antioqueño y morcilla crocante en rodajas, chicharrón carnudo, maduritos calados, carne molida criolla, dos huevos de codorniz, aguacate y hogao caliente.',
      base_price: 22.50,
      image_url: '/images/products/salchipapa-paisa.jpeg',
    },
    {
      id: 'salchipapa-marina',
      category_id: 'salchipapas',
      name: 'Salchipapa Mar & Tierra del Pacífico',
      description: 'Papas rústicas y chips de plátano verde, salchicha ahumada, camarones y anillos de calamar al ajillo en salsa encocada cremosa, queso gratinado y limón mandarino.',
      base_price: 24.00,
      image_url: '/images/products/salchipapa-marina.jpeg',
    },
    {
      id: 'salchipapa-trufada',
      category_id: 'salchipapas',
      name: 'Salchipapa Rolita Trufada & Paipa',
      description: 'Mezcla de papa nativa sabanera y papa criolla, salchicha artesanal de ternera, hongos portobello salteados al ajillo, queso paipa rallado fundido, tocineta ahumada y mayonesa de trufa negra y cilantro.',
      base_price: 20.50,
      image_url: '/images/products/salchipapa-trufada.jpeg',
    },

    // 🥔 Acompañamientos & Entradas Rápidas
    {
      id: 'papas-rusticas',
      category_id: 'sides',
      name: 'Papas Rústicas de la Casa (Estándar)',
      description: 'Papas cortadas en gajos con cáscara, doble cocción crocante, sazonadas con flor de sal marina y páprika ahumada.',
      base_price: 5.50,
      image_url: '/images/products/papas-rusticas.jpeg',
    },
    {
      id: 'empanaditas-criollas',
      category_id: 'sides',
      name: 'Empanaditas Criollas de Carne (4 uds)',
      description: 'Empanadas de maíz crocante rellenas de carne desmechada y papa criolla, servidas con ají bogotano y limón.',
      base_price: 7.50,
      image_url: '/images/products/empanaditas-criollas.jpeg',
    },
    {
      id: 'yucas-crocantes',
      category_id: 'sides',
      name: 'Yucas Crocantes con Suero',
      description: 'Bastones de yuca frita dorada con costra crujiente, acompañados de suero costeño artesanal.',
      base_price: 6.50,
      image_url: '/images/products/yucas-crocantes.jpeg',
    },
    {
      id: 'arepitas-choclo',
      category_id: 'sides',
      name: 'Arepitas de Choclo con Queso (2 uds)',
      description: 'Masa dulce de maíz choclo tierno a la plancha con mantequilla y lámina generosa de queso campesino fresco.',
      base_price: 6.00,
      image_url: '/images/products/arepitas-choclo.jpeg',
    },

    // 🥤 Bebidas Artesanales
    {
      id: 'limonada-coco',
      category_id: 'drinks',
      name: 'Limonada de Coco & Cardamomo',
      description: 'Frappé espeso de leche de coco natural, zumo de lima recién exprimido y toque aromático de cardamomo.',
      base_price: 6.50,
      image_url: '/images/products/limonada-coco.jpeg',
    },
    {
      id: 'limonada-panela',
      category_id: 'drinks',
      name: 'Limonada de Panela & Maracuyá',
      description: 'Refresco frío de panela orgánica macerada con pulpa fresca de maracuyá ácido.',
      base_price: 5.50,
      image_url: '/images/products/limonada-panela.jpeg',
    },
    {
      id: 'soda-lulo',
      category_id: 'drinks',
      name: 'Soda Artesanal de Lulo & Hierbabuena',
      description: 'Pulpa de lulo colombiano batida con soda con gas, hojas de hierbabuena y hielo.',
      base_price: 5.50,
      image_url: '/images/products/soda-lulo.jpeg',
    },
    {
      id: 'malta-leche-condensada',
      category_id: 'drinks',
      name: 'Malta Fría con Leche Condensada',
      description: 'Botella de Pony Malta helada servida con hilo espeso de leche condensada al estilo tradicional.',
      base_price: 4.50,
      image_url: '/images/products/malta-leche-condensada.jpeg',
    },
    {
      id: 'gaseosa-postobon',
      category_id: 'drinks',
      name: 'Gaseosa Colombiana / Postobón 355ml',
      description: 'Colombiana, Manzana Postobón o Bretaña helada.',
      base_price: 3.50,
      image_url: '/images/products/gaseosa-postobon.jpeg',
    },

    // 🍮 Postres Rápidos
    {
      id: 'oblea-septima',
      category_id: 'desserts',
      name: 'Oblea Deconstruida de la Séptima',
      description: 'Capas de barquillo crocante intercaladas con arequipe de leche entero, queso costeño rallado y dulce casero de moras silvestres.',
      base_price: 6.50,
      image_url: '/images/products/oblea-septima.jpeg',
    },
    {
      id: 'churros-criollos',
      category_id: 'desserts',
      name: 'Churros Criollos con Salsa de Café',
      description: '4 bastones de churro recién fritos azucarados con canela, servidos con dip de caramelo y café de origen colombiano.',
      base_price: 6.00,
      image_url: '/images/products/churros-criollos.jpeg',
    },
  ];

  for (const prod of products) {
    await db.query(
      `INSERT INTO products (id, category_id, name, description, base_price, image_url, is_available)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (id) DO UPDATE SET 
         category_id = EXCLUDED.category_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         base_price = EXCLUDED.base_price,
         image_url = EXCLUDED.image_url,
         is_available = true`,
      [prod.id, prod.category_id, prod.name, prod.description, prod.base_price, prod.image_url]
    );
  }

  console.log(`✅ Seed complete: ${categories.length} categories, ${products.length} products in CAD.`);
}

seed().catch((err) => {
  console.error('❌ Error during seed:', err);
  process.exit(1);
});
