import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MigrationFilePair {
  id: string;
  name: string;
  upFile: string;
  downFile: string;
  upSql: string;
  downSql: string;
}

export function loadMigrationFiles(): MigrationFilePair[] {
  const migrationsDir = path.resolve(__dirname, 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  const files = fs.readdirSync(migrationsDir).sort();
  const upFiles = files.filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'));

  return upFiles.map((upFile) => {
    const baseName = upFile.replace(/\.sql$/, '');
    const downFile = `${baseName}.down.sql`;
    const upPath = path.join(migrationsDir, upFile);
    const downPath = path.join(migrationsDir, downFile);

    return {
      id: baseName.split('_')[0] || baseName,
      name: baseName,
      upFile,
      downFile,
      upSql: fs.readFileSync(upPath, 'utf-8'),
      downSql: fs.existsSync(downPath) ? fs.readFileSync(downPath, 'utf-8') : '',
    };
  });
}

export const POSTGIS_QUERIES = {
  ENGINE_A_ORGANIC_FEED: `
    SELECT
      p.*,
      ST_Distance(
        p.publishing_point,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) / 1000.0 AS distance_km
    FROM posts p
    WHERE p.deleted_at IS NULL
      AND p.moderation_status = 'approved'
      AND p.classification = 'organic'
      AND p.engine = 'ORGANIC_ENTERTAINMENT'
      AND (
        p.audience_scope = 'worldwide'
        OR (p.audience_scope = 'country' AND LOWER(p.publishing_country) = LOWER($5))
        OR (p.audience_scope = 'state'   AND LOWER(p.publishing_state)   = LOWER($4))
        OR (p.audience_scope = 'city'    AND LOWER(p.publishing_city)    = LOWER($3))
        OR (
          p.max_radius_meters IS NOT NULL
          AND ST_DWithin(
            p.publishing_point,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            p.max_radius_meters
          )
        )
      )
    ORDER BY p.published_at DESC
    LIMIT $6 OFFSET $7;
  `,

  ENGINE_B_COMMERCIAL_CAMPAIGNS: `
    SELECT
      c.*,
      b.name AS business_name,
      b.category AS business_category,
      b.is_verified AS business_verified,
      bl.location_verified,
      ST_Distance(
        c.origin_point,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) / 1000.0 AS distance_km
    FROM campaigns c
    JOIN businesses b ON b.id = c.business_id AND b.deleted_at IS NULL
    JOIN business_locations bl ON bl.id = c.business_location_id
    WHERE c.is_active = TRUE
      AND c.approval_status = 'approved'
      AND c.origin_verified = TRUE
      AND b.is_verified = TRUE
      AND b.verification_status = 'approved'
      AND bl.location_verified = TRUE
      AND bl.verification_status = 'approved'
      AND NOW() BETWEEN c.start_date AND c.end_date
      AND c.budget_spent_paise < c.budget_total_paise
      AND c.selected_radius_meters <= 40000
      AND ST_DWithin(
        c.origin_point,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        LEAST(c.selected_radius_meters, 40000)
      )
      AND (
        SELECT COUNT(*)
        FROM ad_impressions ai
        WHERE ai.campaign_id = c.id
          AND ai.viewer_user_id = $3
          AND ai.impression_date = CURRENT_DATE
      ) < c.max_impressions_per_user_day
    ORDER BY distance_km ASC;
  `,

  OUTBOX_CLAIM_BATCH: `
    WITH claimable AS (
      SELECT id
      FROM outbox_events
      WHERE (
        (status = 'pending' AND next_attempt_at <= NOW())
        OR (status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at <= NOW())
      )
      AND attempts < max_attempts
      ORDER BY next_attempt_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox_events o
    SET status = 'processing',
        worker_id = $2,
        lease_expires_at = NOW() + ($3 || ' seconds')::INTERVAL,
        attempts = o.attempts + 1,
        updated_at = NOW()
    FROM claimable c
    WHERE o.id = c.id
    RETURNING o.*;
  `,
};

export interface IDatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount?: number }>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: IDatabaseClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  isLiveServer(): boolean;
}

class PgPoolClient implements IDatabaseClient {
  private pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.pool = pool;
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount?: number }> {
    const res = await this.pool.query(sql, params);
    return { rows: res.rows, rowCount: res.rowCount ?? undefined };
  }

  public async exec(sql: string): Promise<void> {
    await this.pool.query(sql);
  }

  public async transaction<T>(fn: (tx: IDatabaseClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const txClient: IDatabaseClient = {
        query: async <R = any>(q: string, p?: any[]) => {
          const r = await client.query(q, p);
          return { rows: r.rows, rowCount: r.rowCount ?? undefined };
        },
        exec: async (s: string) => {
          await client.query(s);
        },
        transaction: async () => {
          throw new Error('Nested transactions not supported');
        },
        close: async () => {},
        isLiveServer: () => true,
      };
      const result = await fn(txClient);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public isLiveServer(): boolean {
    return true;
  }
}

class PGliteDatabaseClient implements IDatabaseClient {
  private pglite: PGlite;

  constructor(pglite: PGlite) {
    this.pglite = pglite;
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount?: number }> {
    const res = await this.pglite.query(sql, params);
    return { rows: res.rows as T[], rowCount: res.rows.length };
  }

  public async exec(sql: string): Promise<void> {
    await this.pglite.exec(sql);
  }

  public async transaction<T>(fn: (tx: IDatabaseClient) => Promise<T>): Promise<T> {
    return await this.pglite.transaction(async (tx) => {
      const txClient: IDatabaseClient = {
        query: async <R = any>(q: string, p?: any[]) => {
          const r = await tx.query(q, p);
          return { rows: r.rows as R[], rowCount: r.rows.length };
        },
        exec: async (s: string) => {
          await tx.exec(s);
        },
        transaction: async () => {
          throw new Error('Nested transactions not supported');
        },
        close: async () => {},
        isLiveServer: () => false,
      };
      return await fn(txClient);
    });
  }

  public async close(): Promise<void> {
    await this.pglite.close();
  }

  public isLiveServer(): boolean {
    return false;
  }
}

let activeClient: IDatabaseClient | null = null;
let activePool: pg.Pool | null = null;

export async function initDatabase(options?: { forceMemory?: boolean; customDataDir?: string }): Promise<IDatabaseClient> {
  if (activeClient) {
    return activeClient;
  }

  const databaseUrl = process.env.DATABASE_URL;

  // Attempt real PostgreSQL 16 connection if DATABASE_URL is configured and not forced to memory
  if (databaseUrl && !options?.forceMemory && !databaseUrl.includes('CHANGE_ME')) {
    try {
      const pool = new Pool({
        connectionString: databaseUrl,
        connectionTimeoutMillis: 15000,
        ssl: { rejectUnauthorized: false },
        idleTimeoutMillis: 30000,
        max: 20,
      });

      // Probe connection with timeout
      const probeRes = await pool.query('SELECT 1 as connected;');
      if (probeRes.rows[0]?.connected === 1) {
        activePool = pool;
        activeClient = new PgPoolClient(pool);
        console.log('[LocalNet Database] Connected to live PostgreSQL server via DATABASE_URL');
        return activeClient;
      }
    } catch (err: any) {
      console.warn(`[LocalNet Database] PostgreSQL connection to DATABASE_URL failed: ${err?.message}. Initializing persistent embedded PostGIS engine.`);
    }
  }

  // Persistent PostGIS embedded storage across restarts
  const dataDir = options?.customDataDir || path.resolve(process.cwd(), '.localnet_pgdata');
  const pgliteInstance = new PGlite(dataDir, {
    extensions: { postgis },
  });

  // Ensure PostGIS extension is ready
  await pgliteInstance.exec('CREATE EXTENSION IF NOT EXISTS "postgis";');

  activeClient = new PGliteDatabaseClient(pgliteInstance);
  console.log(`[LocalNet Database] Embedded PostgreSQL 16 + PostGIS 3.4 engine active (Storage: ${dataDir})`);
  return activeClient;
}

export function getDbClient(): IDatabaseClient {
  if (!activeClient) {
    throw new Error('Database client not initialized. Call initDatabase() first.');
  }
  return activeClient;
}

export async function checkDbHealth(): Promise<{
  connected: boolean;
  engine: string;
  postgisVersion?: string;
  version?: string;
  error?: string;
}> {
  try {
    const client = getDbClient();
    const verRes = await client.query('SELECT version();');
    const postgisRes = await client.query('SELECT PostGIS_Version();');
    return {
      connected: true,
      engine: client.isLiveServer() ? 'PostgreSQL Pool (node-postgres)' : 'Embedded PostgreSQL + PostGIS (Persistent Disk)',
      version: verRes.rows[0]?.version || 'PostgreSQL 16+',
      postgisVersion: postgisRes.rows[0]?.postgis_version || 'PostGIS 3.4+',
    };
  } catch (err: any) {
    return {
      connected: false,
      engine: 'disconnected',
      error: err?.message || String(err),
    };
  }
}

export async function closePool(): Promise<void> {
  if (activePool) {
    await activePool.end();
    activePool = null;
  }
  if (activeClient) {
    await activeClient.close();
    activeClient = null;
  }
}

