import { IDatabaseClient } from '../postgresPool.ts';

export interface GeoDecisionRecord {
  id?: string;
  timestamp?: string;
  entityType: 'post' | 'campaign' | 'service' | 'marketplace_delivery';
  entityId: string;
  engine: 'ENGINE_A_ORGANIC' | 'ENGINE_B_COMMERCIAL';
  originCity: string;
  originCoords: { lat: number; lon: number };
  targetScope: string;
  radiusKm: number | null;
  viewerCity: string;
  viewerDistanceKm: number;
  isDelivered: boolean;
  ruleCode: string;
  notes: string;
}

export interface AdminCorrectOriginParams {
  actorAdminId: string;
  actorRole: string;
  postId: string;
  newLongitude: number;
  newLatitude: number;
  newCity: string;
  newState: string;
  newCountry: string;
  ticketReference: string;
  reason: string;
}

export class AuditRepository {
  private client: IDatabaseClient;

  constructor(client: IDatabaseClient) {
    this.client = client;
  }

  public async recordGeoDecision(record: GeoDecisionRecord): Promise<void> {
    try {
      await this.client.query(`
        INSERT INTO geo_audit_logs (
          entity_type, entity_id, engine,
          origin_city, origin_point, target_scope,
          radius_km, viewer_city, viewer_distance_km,
          is_delivered, rule_code, notes, created_at
        )
        VALUES (
          $1, $2, $3,
          $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7,
          $8, $9, $10,
          $11, $12, $13, NOW()
        );
      `, [
        record.entityType,
        record.entityId,
        record.engine,
        record.originCity,
        record.originCoords.lon,
        record.originCoords.lat,
        record.targetScope,
        record.radiusKm,
        record.viewerCity,
        record.viewerDistanceKm,
        record.isDelivered,
        record.ruleCode,
        record.notes
      ]);
    } catch (e) {
      // Non-blocking for analytics
      console.warn('Failed to record geo decision:', e);
    }
  }

  public async getAuditLogs(limit = 50): Promise<any[]> {
    const res = await this.client.query(`
      SELECT
        id,
        entity_type AS "entityType",
        entity_id AS "entityId",
        engine,
        origin_city AS "originCity",
        ST_X(origin_point::geometry) AS "originLon",
        ST_Y(origin_point::geometry) AS "originLat",
        target_scope AS "targetScope",
        radius_km AS "radiusKm",
        viewer_city AS "viewerCity",
        viewer_distance_km AS "viewerDistanceKm",
        is_delivered AS "isDelivered",
        rule_code AS "ruleCode",
        notes,
        created_at AS "timestamp"
      FROM geo_audit_logs
      ORDER BY created_at DESC
      LIMIT $1;
    `, [limit]);

    return res.rows.map((r: any) => ({
      ...r,
      originCoords: { lat: Number(r.originLat), lon: Number(r.originLon) }
    }));
  }

  public async adminCorrectPostOrigin(params: AdminCorrectOriginParams): Promise<any> {
    if (params.actorRole !== 'platform_admin') {
      throw new Error('SECURITY_VIOLATION: Origin correction requires platform_admin role.');
    }

    if (!params.ticketReference || params.ticketReference.trim().length === 0) {
      throw new Error('SECURITY_VIOLATION: Origin correction requires mandatory ticket_reference.');
    }

    return await this.client.transaction(async (tx) => {
      // 1. Get old post location
      const oldPost = await tx.query(`
        SELECT
          p.id,
          p.publishing_city,
          p.publishing_state,
          ST_AsEWKT(p.publishing_point) AS old_ewkt
        FROM posts p
        WHERE p.id = $1;
      `, [params.postId]);

      if (oldPost.rows.length === 0) {
        throw new Error(`Post ${params.postId} not found.`);
      }

      const oldEwkt = oldPost.rows[0].old_ewkt;

      // 2. Insert privileged token to satisfy trigger check
      const txidRes = await tx.query('SELECT txid_current() AS txid;');
      const txid = txidRes.rows[0].txid;

      await tx.query(`
        INSERT INTO _privileged_origin_correction_tokens (
          txid, target_table, target_id, admin_user_id, created_at
        )
        VALUES ($1, 'posts', $2, $3, NOW())
        ON CONFLICT (txid) DO NOTHING;
      `, [txid, params.postId, params.actorAdminId]);

      // 3. Update post coordinates
      await tx.query(`
        UPDATE posts
        SET
          publishing_point = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
          publishing_city = $3,
          publishing_state = $4,
          publishing_country = $5,
          updated_at = NOW()
        WHERE id = $6;
      `, [
        params.newLongitude,
        params.newLatitude,
        params.newCity,
        params.newState,
        params.newCountry,
        params.postId
      ]);

      const newPostRes = await tx.query(`
        SELECT ST_AsEWKT(publishing_point) AS new_ewkt
        FROM posts
        WHERE id = $1;
      `, [params.postId]);

      const newEwkt = newPostRes.rows[0]?.new_ewkt;

      // 4. Log in audit_logs
      const auditRes = await tx.query(`
        INSERT INTO audit_logs (
          actor_user_id, actor_role, action, target_type, target_id,
          ticket_reference, metadata, created_at
        )
        VALUES (
          $1, $2, 'ADMIN_CORRECT_POST_ORIGIN', 'posts', $3,
          $4, $5, NOW()
        )
        RETURNING id, action, target_id, ticket_reference, metadata, created_at;
      `, [
        params.actorAdminId,
        params.actorRole,
        params.postId,
        params.ticketReference,
        JSON.stringify({
          reason: params.reason,
          old_origin: oldEwkt,
          new_origin: newEwkt,
          city: params.newCity
        })
      ]);

      return auditRes.rows[0];
    });
  }
}
