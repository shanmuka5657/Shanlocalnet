import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

/**
 * Loads all ordered Stage B.1 forward and rollback SQL migrations from src/db/migrations
 */
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

/**
 * Canonical PostGIS query templates used by the PostgreSQL repository adapter.
 * Guaranteed longitude-first ordering: ST_MakePoint(longitude, latitude)
 */
export const POSTGIS_QUERIES = {
  /**
   * Engine A: Organic feed query using GIST index on publishing_point + ST_DWithin in meters
   */
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

  /**
   * Engine B: Commercial & Advertisement feed query strictly capped at <= 40,000 meters (40 km)
   * and requiring verified business & location origin.
   */
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

  /**
   * Crash-safe Outbox Worker Claim Query (§4.9)
   * Uses FOR UPDATE SKIP LOCKED and reclaims expired worker leases cleanly.
   */
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
