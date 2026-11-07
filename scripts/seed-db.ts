// ============================================================================
// scripts/seed-db.ts — Standalone Database Migration & Seed Runner
// ============================================================================

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../lib/db/index.ts';

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

  console.log('⚙️ [DB] Applying DDL migration...');
  await db.exec(schemaSql);
  console.log('✅ [DB] DDL migration applied successfully.');

  console.log('⚙️ [DB] Inserting seed data...');
  await db.exec(seedSql);
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
    { Entity: 'products', Count: Number(prodCount.rows[0].count), Expected: 5 },
    { Entity: 'modifier_groups', Count: Number(groupCount.rows[0].count), Expected: 4 },
    { Entity: 'modifiers', Count: Number(modCount.rows[0].count), Expected: 15 },
    { Entity: 'product_modifier_groups', Count: Number(linkCount.rows[0].count), Expected: 6 },
  ]);

  const elapsed = Date.now() - startTime;
  console.log(`✨ [DB] Completed migration & seed in ${elapsed}ms.`);
}

runSeed()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ [DB] Error executing seed:', err);
    process.exit(1);
  });
