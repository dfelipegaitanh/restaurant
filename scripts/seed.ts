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

    // 🍟 Salchipapas Monumentales
    {
      id: 'salchipapa-clasica',
      category_id: 'salchipapas',
      name: 'Salchipapa Clásica Bogotana',
      description: 'Cama generosa de papas rústicas en cascos, salchicha americana en rodajas doradas, queso mozzarella fundido derretido al soplete y lluvia de salsa tártara y piña.',
      base_price: 13.50,
      image_url: '🍟',
    },
    {
      id: 'salchipapa-bestia',
      category_id: 'salchipapas',
      name: 'Salchipapa La Bestia Costeña',
      description: 'Papas rústicas, salchicha americana, butifarra frita en cuartos, sobrebarriga desmechada al hogao, cubos dorados de queso costeño frito y chorro generoso de suero.',
      base_price: 19.50,
      image_url: '👑',
    },
    {
      id: 'salchipapa-chicharronera',
      category_id: 'salchipapas',
      name: 'Salchipapa Chicharronera Criolla',
      description: 'Base mixta de papa criolla frita y papas rústicas, 150g de trozos de chicharrón tostado con limón, salchicha ahumada, hogao caliente y queso campesino gratinado.',
      base_price: 21.50,
      image_url: '🥓',
    },
    {
      id: 'salchipapa-maicitos',
      category_id: 'salchipapas',
      name: 'Salchipapa Maicitos & Bacon Lovers',
      description: 'Papas rústicas, salchicha americana dorada, tocineta crocante picada, maíz dulce salteado a la mantequilla y baño de salsa de cuatro quesos fundidos.',
      base_price: 17.50,
      image_url: '🧀',
    },
    {
      id: 'salchipapa-guajira',
      category_id: 'salchipapas',
      name: 'Salchipapa Picante Guajira',
      description: 'Papas rústicas, salchicha tipo kielbasa picante, chicharrón, guacamole criollo, ají dulce ahumado, cebolla morada encurtida y queso costeño.',
      base_price: 18.50,
      image_url: '🌶️',
    },

    // 🥔 Acompañamientos & Entradas Rápidas
    {
      id: 'papas-rusticas',
      category_id: 'sides',
      name: 'Papas Rústicas de la Casa (Estándar)',
      description: 'Papas cortadas en gajos con cáscara, doble cocción crocante, sazonadas con flor de sal marina y páprika ahumada.',
      base_price: 5.50,
      image_url: '🍟',
    },
    {
      id: 'empanaditas-criollas',
      category_id: 'sides',
      name: 'Empanaditas Criollas de Carne (4 uds)',
      description: 'Empanadas de maíz crocante rellenas de carne desmechada y papa criolla, servidas con ají bogotano y limón.',
      base_price: 7.50,
      image_url: '🥟',
    },
    {
      id: 'yucas-crocantes',
      category_id: 'sides',
      name: 'Yucas Crocantes con Suero',
      description: 'Bastones de yuca frita dorada con costra crujiente, acompañados de suero costeño artesanal.',
      base_price: 6.50,
      image_url: '🥢',
    },
    {
      id: 'arepitas-choclo',
      category_id: 'sides',
      name: 'Arepitas de Choclo con Queso (2 uds)',
      description: 'Masa dulce de maíz choclo tierno a la plancha con mantequilla y lámina generosa de queso campesino fresco.',
      base_price: 6.00,
      image_url: '🫓',
    },

    // 🥤 Bebidas Artesanales
    {
      id: 'limonada-coco',
      category_id: 'drinks',
      name: 'Limonada de Coco & Cardamomo',
      description: 'Frappé espeso de leche de coco natural, zumo de lima recién exprimido y toque aromático de cardamomo.',
      base_price: 6.50,
      image_url: '🥥',
    },
    {
      id: 'limonada-panela',
      category_id: 'drinks',
      name: 'Limonada de Panela & Maracuyá',
      description: 'Refresco frío de panela orgánica macerada con pulpa fresca de maracuyá ácido.',
      base_price: 5.50,
      image_url: '🍹',
    },
    {
      id: 'soda-lulo',
      category_id: 'drinks',
      name: 'Soda Artesanal de Lulo & Hierbabuena',
      description: 'Pulpa de lulo colombiano batida con soda con gas, hojas de hierbabuena y hielo.',
      base_price: 5.50,
      image_url: '🍃',
    },
    {
      id: 'malta-leche-condensada',
      category_id: 'drinks',
      name: 'Malta Fría con Leche Condensada',
      description: 'Botella de Pony Malta helada servida con hilo espeso de leche condensada al estilo tradicional.',
      base_price: 4.50,
      image_url: '🥛',
    },
    {
      id: 'gaseosa-postobon',
      category_id: 'drinks',
      name: 'Gaseosa Colombiana / Postobón 355ml',
      description: 'Colombiana, Manzana Postobón o Bretaña helada.',
      base_price: 3.50,
      image_url: '🥤',
    },

    // 🍮 Postres Rápidos
    {
      id: 'oblea-septima',
      category_id: 'desserts',
      name: 'Oblea Deconstruida de la Séptima',
      description: 'Capas de barquillo crocante intercaladas con arequipe de leche entero, queso costeño rallado y dulce casero de moras silvestres.',
      base_price: 6.50,
      image_url: '🧇',
    },
    {
      id: 'churros-criollos',
      category_id: 'desserts',
      name: 'Churros Criollos con Salsa de Café',
      description: '4 bastones de churro recién fritos azucarados con canela, servidos con dip de caramelo y café de origen colombiano.',
      base_price: 6.00,
      image_url: '🍩',
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
