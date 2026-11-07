// ============================================================================
// lib/db/index.ts — Dual-Mode Database Adapter (PGlite WASM / node-postgres)
// ============================================================================

import fs from 'node:fs/promises';
import path from 'node:path';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
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
      async exec(sql: string): Promise<void> {
        await pool.query(sql);
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
            async exec(sql: string): Promise<void> {
              await conn.query(sql);
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

  const dataDir = process.env.PGLITE_DATA_DIR || './data/pglite_db';
  if (dataDir && !dataDir.startsWith('memory://')) {
    await fs.mkdir(path.resolve(process.cwd(), dataDir), { recursive: true });
  }
  const pglite = new PGlite(dataDir);

  const client: DbClient = {
    async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
      const res = await pglite.query<T>(sql, params);
      return {
        rows: res.rows,
        rowCount: res.affectedRows ?? res.rows.length,
      };
    },
    async exec(sql: string): Promise<void> {
      await pglite.exec(sql);
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
          async exec(sql: string): Promise<void> {
            await tx.exec(sql);
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
          WHERE table_name = 'categories'
        ) as exists;
      `);

      if (!check.rows[0]?.exists) {
        console.log('⚡ [DB] First boot detected: table categories missing.');
        console.log('⚡ [DB] Auto-initializing PostgreSQL 16 schema and seed data...');

        const basePath = process.cwd();
        const schemaPath = path.join(basePath, 'lib', 'db', 'schema.sql');
        const seedPath = path.join(basePath, 'lib', 'db', 'seed.sql');

        const schemaSql = await fs.readFile(schemaPath, 'utf-8');
        await client.exec(schemaSql);

        const seedSql = await fs.readFile(seedPath, 'utf-8');
        await client.exec(seedSql);

        console.log('✅ [DB] Auto-initialization completed successfully.');
      }
    } catch (err) {
      console.error('❌ [DB] Error during auto-initialization:', err);
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

export const db = {
  getDb,
};
