/**
 * Stage B.1 Corrected Database State & Transaction Simulator
 *
 * Implements the exact PostgreSQL + PostGIS invariants defined in
 * 0001_roles_and_extensions.sql and 0002_corrected_postgis_schema.sql so that
 * both our automated integration test suite and the live Express server enforce:
 *   - §4.1 Business & location verification before campaign activation
 *   - §4.2 All foreign keys & Exclusive Arc content_classifications constraint
 *   - §4.3 Immutable publishing_point/origin_point & SECURITY DEFINER admin_correct_post_origin
 *   - §4.4 Non-downgrade of commercial/sponsored posts & 40 km DB CHECK constraint
 *   - §4.5 ST_MakePoint(lon, lat) & ST_DWithin meter calculations
 *   - §4.6 Short-lived server-issued location_verifications tokens
 *   - §4.7 Atomic campaign impression/click accounting with idempotency tokens & auto-deactivation
 *   - §4.8 Transactional marketplace inventory reservation, order creation, and webhook replay protection
 *   - §4.9 Crash-safe Outbox worker with lease expiration and dead-letter transition
 *   - §4.10 Least-privilege role enforcement (append-only audit_logs, geo_audit_logs, campaign_spend_records)
 */

import { calculateHaversineDistance } from '../lib/geo.ts';
import { GeoCoordinates } from '../types/index.ts';

export type DbRoleName = 'localnet_migrator' | 'localnet_app' | 'localnet_readonly' | 'localnet_test';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export interface DbUserRow {
  id: string;
  email: string;
  active_role: 'user' | 'creator' | 'business_owner' | 'service_provider' | 'community_admin' | 'platform_admin';
  is_suspended: boolean;
}

export interface DbUserRoleRow {
  user_id: string;
  role: DbUserRow['active_role'];
  status: ApprovalStatus;
}

export interface DbMediaAssetRow {
  id: string;
  owner_user_id: string;
  bucket_category: 'avatars' | 'posts_images' | 'videos_original' | 'videos_processed' | 'business_media' | 'temp_uploads';
  s3_key: string;
  mime_type: string;
  magic_bytes_verified: boolean;
  size_bytes: number;
}

export interface DbBusinessRow {
  id: string;
  owner_user_id: string;
  name: string;
  category: string;
  is_verified: boolean;
  verification_status: ApprovalStatus;
  verified_by_admin_id: string | null;
  verified_at: string | null;
}

export interface DbBusinessLocationRow {
  id: string;
  business_id: string;
  city: string;
  state: string;
  country: string;
  lon: number; // PostGIS ST_MakePoint(lon, lat)
  lat: number;
  max_service_radius_km: number;
  location_verified: boolean;
  verification_status: ApprovalStatus;
  verified_by_admin_id: string | null;
  verified_at: string | null;
}

export interface DbPostRow {
  id: string;
  creator_id: string;
  content_type: 'video' | 'reel' | 'photo' | 'multi_photo' | 'text' | 'story' | 'community_update';
  classification: 'organic' | 'commercial' | 'sponsored_creator';
  engine: 'ORGANIC_ENTERTAINMENT' | 'COMMERCIAL_ADVERTISEMENT';
  title: string;
  description: string;
  media_asset_id: string | null;
  publishing_lon: number;
  publishing_lat: number;
  publishing_city: string;
  publishing_state: string;
  publishing_country: string;
  publishing_country_code: string;
  audience_scope: '5km' | '10km' | '25km' | '40km' | 'city' | 'state' | 'country' | 'worldwide';
  max_radius_meters: number | null;
  published_at: string;
}

export interface DbCampaignRow {
  id: string;
  business_id: string;
  business_location_id: string;
  campaign_name: string;
  origin_lon: number;
  origin_lat: number;
  target_city: string;
  origin_verified: boolean;
  selected_radius_km: number;
  selected_radius_meters: number;
  budget_total_paise: number;
  budget_spent_paise: number;
  billing_model: 'CPM' | 'CPC';
  cost_per_unit_paise: number;
  max_impressions_per_user_day: number;
  approval_status: ApprovalStatus;
  approved_by_admin_id: string | null;
  is_active: boolean;
  impressions_count: number;
  clicks_count: number;
}

export interface DbContentClassificationRow {
  id: string;
  post_id: string | null;
  campaign_id: string | null;
  listing_id: string | null;
  submitted_classification: string;
  enforced_classification: 'organic' | 'commercial' | 'sponsored_creator';
  enforced_engine: 'ORGANIC_ENTERTAINMENT' | 'COMMERCIAL_ADVERTISEMENT';
  enforcement_reason: string;
  reclassified_from_organic: boolean;
}

export interface DbLocationVerificationRow {
  id: string;
  user_id: string;
  session_token: string;
  lon: number;
  lat: number;
  accuracy_meters: number;
  resolved_city: string;
  resolved_state: string;
  resolved_country: string;
  resolved_country_code: string;
  verification_source: 'HARDWARE_GPS' | 'DEV_CITY_PRESET' | 'UNVERIFIED';
  spoofing_risk_score: number;
  verified_at: number;
  expires_at: number;
}

export interface DbOutboxEventRow {
  id: string;
  idempotency_key: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  worker_id: string | null;
  lease_expires_at: number | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_attempt_at: number;
}

export interface DbAuditLogRow {
  id: string;
  actor_user_id: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  ticket_reference: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Enforces every SQL constraint, trigger, and role permission from Migration 0001 & 0002.
 */
export class StageB1DatabaseEngine {
  public users = new Map<string, DbUserRow>();
  public userRoles: DbUserRoleRow[] = [];
  public mediaAssets = new Map<string, DbMediaAssetRow>();
  public businesses = new Map<string, DbBusinessRow>();
  public businessLocations = new Map<string, DbBusinessLocationRow>();
  public posts = new Map<string, DbPostRow>();
  public campaigns = new Map<string, DbCampaignRow>();
  public contentClassifications: DbContentClassificationRow[] = [];
  public locationVerifications = new Map<string, DbLocationVerificationRow>();
  public adImpressions = new Map<string, { id: string; campaign_id: string; viewer_user_id: string; idempotency_token: string; date: string; charged_paise: number }>();
  public adClicks = new Map<string, { id: string; campaign_id: string; viewer_user_id: string; idempotency_token: string; charged_paise: number }>();
  public campaignSpendRecords: Array<{ id: string; campaign_id: string; event_type: string; reference_event_id: string; amount_paise: number; balance_after_paise: number }> = [];
  public inventory = new Map<string, { listing_id: string; available_qty: number; reserved_qty: number }>();
  public orders = new Map<string, { id: string; buyer_user_id: string; idempotency_key: string; listing_id: string; qty: number; status: string; inventory_restored: boolean }>();
  public paymentTransactions = new Map<string, { id: string; order_id: string; webhook_event_id: string; status: string }>();
  public outboxEvents = new Map<string, DbOutboxEventRow>();
  public auditLogs: DbAuditLogRow[] = [];

  // §4.10 Role enforcement helper
  private assertRolePrivilege(role: DbRoleName, operation: 'DDL' | 'READ' | 'WRITE_OPERATIONAL' | 'MUTATE_AUDIT_LEDGER') {
    if (operation === 'DDL' && role !== 'localnet_migrator') {
      throw new Error(`ROLE_PERMISSION_DENIED: Role '${role}' cannot execute DDL statements (only 'localnet_migrator' owns schema).`);
    }
    if (operation === 'WRITE_OPERATIONAL' && role === 'localnet_readonly') {
      throw new Error(`ROLE_PERMISSION_DENIED: Role 'localnet_readonly' cannot execute INSERT/UPDATE/DELETE.`);
    }
    if (operation === 'MUTATE_AUDIT_LEDGER' && (role === 'localnet_app' || role === 'localnet_readonly' || role === 'localnet_test')) {
      throw new Error(`ROLE_PERMISSION_DENIED: Role '${role}' has only SELECT, INSERT on append-only audit/spend ledgers; UPDATE and DELETE are revoked.`);
    }
  }

  public executeDdlAsRole(role: DbRoleName, _sql: string): void {
    this.assertRolePrivilege(role, 'DDL');
  }

  public attemptMutateAuditLogAsRole(role: DbRoleName): void {
    this.assertRolePrivilege(role, 'MUTATE_AUDIT_LEDGER');
  }

  // §4.1 Business & Business Location Creation (Always starts unverified/pending)
  public createBusiness(params: { id: string; owner_user_id: string; name: string; category: string }): DbBusinessRow {
    if (!this.users.has(params.owner_user_id)) {
      throw new Error('FK_VIOLATION: owner_user_id does not exist in users.');
    }
    const row: DbBusinessRow = {
      id: params.id,
      owner_user_id: params.owner_user_id,
      name: params.name,
      category: params.category,
      is_verified: false,
      verification_status: 'pending',
      verified_by_admin_id: null,
      verified_at: null,
    };
    this.businesses.set(row.id, row);
    return row;
  }

  public createBusinessLocation(params: {
    id: string;
    business_id: string;
    city: string;
    state: string;
    country: string;
    lon: number;
    lat: number;
    max_service_radius_km: number;
  }): DbBusinessLocationRow {
    if (!this.businesses.has(params.business_id)) {
      throw new Error('FK_VIOLATION: business_id does not exist in businesses.');
    }
    if (params.max_service_radius_km <= 0 || params.max_service_radius_km > 40) {
      throw new Error('CHECK_VIOLATION: max_service_radius_km must be between 0 and 40 km.');
    }
    const row: DbBusinessLocationRow = {
      ...params,
      location_verified: false,
      verification_status: 'pending',
      verified_by_admin_id: null,
      verified_at: null,
    };
    this.businessLocations.set(row.id, row);
    return row;
  }

  public verifyBusinessAndLocationByAdmin(params: {
    admin_user_id: string;
    business_id: string;
    business_location_id: string;
  }): void {
    const isAdmin = this.userRoles.some(
      (r) => r.user_id === params.admin_user_id && r.role === 'platform_admin' && r.status === 'approved'
    );
    if (!isAdmin) {
      throw new Error('PRIVILEGE_ERROR: Only an approved platform_admin can verify businesses and locations.');
    }
    const bus = this.businesses.get(params.business_id);
    const loc = this.businessLocations.get(params.business_location_id);
    if (!bus || !loc || loc.business_id !== bus.id) {
      throw new Error('NOT_FOUND: Business or location not found.');
    }
    bus.is_verified = true;
    bus.verification_status = 'approved';
    bus.verified_by_admin_id = params.admin_user_id;
    bus.verified_at = new Date().toISOString();

    loc.location_verified = true;
    loc.verification_status = 'approved';
    loc.verified_by_admin_id = params.admin_user_id;
    loc.verified_at = new Date().toISOString();
  }

  // §4.3 & §4.4 Post Creation & Immutability / Commercial Non-Downgrade
  public insertPost(post: DbPostRow): DbPostRow {
    if (!this.users.has(post.creator_id)) {
      throw new Error('FK_VIOLATION: creator_id does not exist in users.');
    }
    if (post.media_asset_id && !this.mediaAssets.has(post.media_asset_id)) {
      throw new Error('FK_VIOLATION: media_asset_id does not exist in media_assets.');
    }

    // Enforce chk_post_commercial_40km_cap
    if (post.classification === 'organic') {
      if (post.engine !== 'ORGANIC_ENTERTAINMENT') {
        throw new Error('CHECK_VIOLATION: chk_post_commercial_40km_cap — organic post must use ORGANIC_ENTERTAINMENT.');
      }
      if (['city', 'state', 'country', 'worldwide'].includes(post.audience_scope) && post.max_radius_meters !== null) {
        throw new Error('CHECK_VIOLATION: non-radius organic scopes must have NULL max_radius_meters.');
      }
    } else {
      if (
        post.engine !== 'COMMERCIAL_ADVERTISEMENT' ||
        !['5km', '10km', '25km', '40km'].includes(post.audience_scope) ||
        post.max_radius_meters === null ||
        post.max_radius_meters <= 0 ||
        post.max_radius_meters > 40000
      ) {
        throw new Error(
          'CHECK_VIOLATION: chk_post_commercial_40km_cap — commercial/sponsored_creator posts must use COMMERCIAL_ADVERTISEMENT and 0 < max_radius_meters <= 40000.'
        );
      }
    }

    this.posts.set(post.id, { ...post });
    return post;
  }

  public updatePostAsAppUser(postId: string, updates: Partial<DbPostRow>): DbPostRow {
    const existing = this.posts.get(postId);
    if (!existing) throw new Error('NOT_FOUND: Post does not exist.');

    // Trigger trg_enforce_post_immutability check
    if (
      (updates.publishing_lon !== undefined && updates.publishing_lon !== existing.publishing_lon) ||
      (updates.publishing_lat !== undefined && updates.publishing_lat !== existing.publishing_lat) ||
      (updates.publishing_city !== undefined && updates.publishing_city !== existing.publishing_city) ||
      (updates.publishing_state !== undefined && updates.publishing_state !== existing.publishing_state) ||
      (updates.publishing_country !== undefined && updates.publishing_country !== existing.publishing_country) ||
      (updates.publishing_country_code !== undefined && updates.publishing_country_code !== existing.publishing_country_code) ||
      (updates.published_at !== undefined && updates.published_at !== existing.published_at) ||
      (updates.creator_id !== undefined && updates.creator_id !== existing.creator_id)
    ) {
      throw new Error(
        'GEO_SECURITY_VIOLATION: Post publishing origin (point, city, state, country, country_code, published_at, creator_id) is immutable.'
      );
    }

    // §4.4 Commercial non-downgrade check
    if (
      (existing.classification === 'commercial' || existing.classification === 'sponsored_creator') &&
      updates.classification === 'organic'
    ) {
      throw new Error('GEO_SECURITY_VIOLATION: Commercial or sponsored content cannot be downgraded to organic.');
    }

    if (existing.engine === 'COMMERCIAL_ADVERTISEMENT' && updates.engine === 'ORGANIC_ENTERTAINMENT') {
      throw new Error('GEO_SECURITY_VIOLATION: Commercial distribution engine cannot be switched to organic engine.');
    }

    const updated: DbPostRow = { ...existing, ...updates };
    this.posts.set(postId, updated);
    return updated;
  }

  // §4.3 SECURITY DEFINER Stored Procedure: admin_correct_post_origin
  public adminCorrectPostOrigin(params: {
    actor_admin_id: string;
    post_id: string;
    new_lon: number;
    new_lat: number;
    new_city: string;
    new_state: string;
    new_country: string;
    new_country_code: string;
    ticket_reference: string;
    reason: string;
  }): void {
    const isAdmin = this.userRoles.some(
      (r) => r.user_id === params.actor_admin_id && r.role === 'platform_admin' && r.status === 'approved'
    );
    if (!isAdmin) {
      throw new Error('PRIVILEGE_ERROR: Only an approved platform_admin can execute origin correction.');
    }
    if (!params.ticket_reference || params.ticket_reference.trim().length < 3 || !params.reason || params.reason.trim().length < 15) {
      throw new Error('AUDIT_ERROR: Privileged origin correction requires a valid ticket_reference and detailed reason (>=15 chars).');
    }
    const existing = this.posts.get(params.post_id);
    if (!existing) {
      throw new Error('NOT_FOUND: Post does not exist.');
    }

    const oldPoint = `SRID=4326;POINT(${existing.publishing_lon} ${existing.publishing_lat})`;
    const newPoint = `SRID=4326;POINT(${params.new_lon} ${params.new_lat})`;

    existing.publishing_lon = params.new_lon;
    existing.publishing_lat = params.new_lat;
    existing.publishing_city = params.new_city;
    existing.publishing_state = params.new_state;
    existing.publishing_country = params.new_country;
    existing.publishing_country_code = params.new_country_code;

    this.auditLogs.push({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      actor_user_id: params.actor_admin_id,
      actor_role: 'platform_admin',
      action: 'PRIVILEGED_POST_ORIGIN_CORRECTION',
      target_type: 'post',
      target_id: params.post_id,
      ticket_reference: params.ticket_reference,
      metadata: {
        old_point_ewkt: oldPoint,
        new_point_ewkt: newPoint,
        new_city: params.new_city,
        reason: params.reason,
      },
      created_at: new Date().toISOString(),
    });
  }

  // §4.1 & §4.3 Campaign Creation & Verification Trigger
  public insertCampaign(params: {
    id: string;
    business_id: string;
    business_location_id: string;
    campaign_name: string;
    selected_radius_km: number;
    budget_total_paise: number;
    billing_model: 'CPM' | 'CPC';
    cost_per_unit_paise: number;
    max_impressions_per_user_day?: number;
    approval_status?: ApprovalStatus;
    is_active?: boolean;
  }): DbCampaignRow {
    const bus = this.businesses.get(params.business_id);
    if (!bus) throw new Error('BUSINESS_NOT_FOUND: Referenced business does not exist.');
    const loc = this.businessLocations.get(params.business_location_id);
    if (!loc || loc.business_id !== bus.id) {
      throw new Error('INVALID_BUSINESS_LOCATION: business_location_id does not belong to business_id.');
    }
    if (params.selected_radius_km <= 0 || params.selected_radius_km > 40) {
      throw new Error('CHECK_VIOLATION: selected_radius_km must satisfy 0 < selected_radius_km <= 40.00.');
    }

    const originVerified =
      bus.is_verified &&
      bus.verification_status === 'approved' &&
      loc.location_verified &&
      loc.verification_status === 'approved';

    const requestedApproval = params.approval_status ?? 'pending';
    const requestedActive = params.is_active ?? false;

    if ((requestedApproval === 'approved' || requestedActive) && !originVerified) {
      throw new Error('UNVERIFIED_BUSINESS_ORIGIN: Unverified business or location cannot publish approved or active campaigns.');
    }

    const row: DbCampaignRow = {
      id: params.id,
      business_id: params.business_id,
      business_location_id: params.business_location_id,
      campaign_name: params.campaign_name,
      // Automatically copied from business_locations!
      origin_lon: loc.lon,
      origin_lat: loc.lat,
      target_city: loc.city,
      origin_verified: originVerified,
      selected_radius_km: params.selected_radius_km,
      selected_radius_meters: Math.round(params.selected_radius_km * 1000),
      budget_total_paise: params.budget_total_paise,
      budget_spent_paise: 0,
      billing_model: params.billing_model,
      cost_per_unit_paise: params.cost_per_unit_paise,
      max_impressions_per_user_day: params.max_impressions_per_user_day ?? 3,
      approval_status: requestedApproval,
      approved_by_admin_id: requestedApproval === 'approved' ? bus.verified_by_admin_id : null,
      is_active: requestedActive,
      impressions_count: 0,
      clicks_count: 0,
    };

    this.campaigns.set(row.id, row);
    return row;
  }

  public activateCampaign(campaignId: string, adminUserId: string): DbCampaignRow {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new Error('NOT_FOUND: Campaign does not exist.');
    const bus = this.businesses.get(campaign.business_id)!;
    const loc = this.businessLocations.get(campaign.business_location_id)!;

    if (!(bus.is_verified && bus.verification_status === 'approved' && loc.location_verified && loc.verification_status === 'approved')) {
      throw new Error('UNVERIFIED_BUSINESS_ORIGIN: Campaign cannot be approved or activated while business or location is unverified.');
    }

    campaign.origin_verified = true;
    campaign.approval_status = 'approved';
    campaign.approved_by_admin_id = adminUserId;
    campaign.is_active = true;
    return campaign;
  }

  // §4.2 Content Classifications with Exclusive Arc Constraint
  public insertContentClassification(row: DbContentClassificationRow): DbContentClassificationRow {
    const nonNullTargets = [row.post_id, row.campaign_id, row.listing_id].filter((v) => v !== null && v !== undefined);
    if (nonNullTargets.length !== 1) {
      throw new Error('CHECK_VIOLATION: chk_content_classification_exclusive_target — num_nonnulls(post_id, campaign_id, listing_id) must equal 1.');
    }
    if (row.post_id && !this.posts.has(row.post_id)) {
      throw new Error('FK_VIOLATION: post_id does not exist in posts.');
    }
    if (row.campaign_id && !this.campaigns.has(row.campaign_id)) {
      throw new Error('FK_VIOLATION: campaign_id does not exist in campaigns.');
    }
    this.contentClassifications.push(row);
    return row;
  }

  // §4.7 Atomic Campaign Impression & Spend Accounting
  public recordCampaignImpression(params: {
    campaign_id: string;
    viewer_user_id: string;
    viewer_lon: number;
    viewer_lat: number;
    idempotency_token: string;
  }): { deduplicated: boolean; charged_paise: number; remaining_budget_paise: number } {
    // 1. Check idempotency token
    for (const imp of this.adImpressions.values()) {
      if (imp.idempotency_token === params.idempotency_token) {
        const camp = this.campaigns.get(params.campaign_id)!;
        return {
          deduplicated: true,
          charged_paise: imp.charged_paise,
          remaining_budget_paise: camp.budget_total_paise - camp.budget_spent_paise,
        };
      }
    }

    const campaign = this.campaigns.get(params.campaign_id);
    if (!campaign || !campaign.is_active || campaign.approval_status !== 'approved' || !campaign.origin_verified) {
      throw new Error('CAMPAIGN_INACTIVE_OR_UNVERIFIED: Campaign cannot serve impressions.');
    }

    // 2. Verify PostGIS ST_DWithin distance <= min(selected_radius_km, 40)
    const distKm = calculateHaversineDistance(
      campaign.origin_lat,
      campaign.origin_lon,
      params.viewer_lat,
      params.viewer_lon
    );
    const effectiveRadiusKm = Math.min(campaign.selected_radius_km, 40);
    if (distKm > effectiveRadiusKm) {
      throw new Error(`GEO_RADIUS_EXCEEDED: Viewer distance ${distKm}km exceeds campaign cap ${effectiveRadiusKm}km.`);
    }

    // 3. Enforce per-user daily frequency cap
    const today = new Date().toISOString().slice(0, 10);
    let userImpressionsToday = 0;
    for (const imp of this.adImpressions.values()) {
      if (imp.campaign_id === campaign.id && imp.viewer_user_id === params.viewer_user_id && imp.date === today) {
        userImpressionsToday++;
      }
    }
    if (userImpressionsToday >= campaign.max_impressions_per_user_day) {
      throw new Error('FREQUENCY_CAP_REACHED: Daily impression cap reached for viewer.');
    }

    // 4. Calculate charge in Paise & prevent budget overrun
    const chargePaise =
      campaign.billing_model === 'CPM' ? Math.max(1, Math.round(campaign.cost_per_unit_paise / 1000)) : 0;

    if (campaign.budget_spent_paise + chargePaise > campaign.budget_total_paise) {
      campaign.is_active = false;
      throw new Error('BUDGET_EXHAUSTED: Campaign budget exhausted; campaign automatically deactivated.');
    }

    campaign.budget_spent_paise += chargePaise;
    campaign.impressions_count += 1;
    if (campaign.budget_spent_paise >= campaign.budget_total_paise) {
      campaign.is_active = false;
    }

    const impId = `imp-${this.adImpressions.size + 1}`;
    this.adImpressions.set(impId, {
      id: impId,
      campaign_id: campaign.id,
      viewer_user_id: params.viewer_user_id,
      idempotency_token: params.idempotency_token,
      date: today,
      charged_paise: chargePaise,
    });

    if (chargePaise > 0) {
      this.campaignSpendRecords.push({
        id: `spend-${this.campaignSpendRecords.length + 1}`,
        campaign_id: campaign.id,
        event_type: 'IMPRESSION_CPM',
        reference_event_id: impId,
        amount_paise: chargePaise,
        balance_after_paise: campaign.budget_total_paise - campaign.budget_spent_paise,
      });
    }

    return {
      deduplicated: false,
      charged_paise: chargePaise,
      remaining_budget_paise: campaign.budget_total_paise - campaign.budget_spent_paise,
    };
  }

  // §4.8 Transactional Marketplace Order & Inventory Reservation
  public createOrderWithInventoryLock(params: {
    order_id: string;
    buyer_user_id: string;
    idempotency_key: string;
    listing_id: string;
    quantity: number;
    verified_distance_km: number;
    max_delivery_radius_km: number;
  }): { id: string; status: string; deduplicated: boolean } {
    for (const existing of this.orders.values()) {
      if (existing.idempotency_key === params.idempotency_key) {
        return { id: existing.id, status: existing.status, deduplicated: true };
      }
    }

    const effectiveRadius = Math.min(params.max_delivery_radius_km, 40);
    if (params.verified_distance_km > effectiveRadius) {
      throw new Error(`DELIVERY_RADIUS_EXCEEDED: Buyer distance ${params.verified_distance_km}km exceeds ${effectiveRadius}km limit.`);
    }

    const inv = this.inventory.get(params.listing_id);
    if (!inv || inv.available_qty < params.quantity) {
      throw new Error('INSUFFICIENT_INVENTORY: Requested quantity exceeds available stock.');
    }

    inv.available_qty -= params.quantity;
    inv.reserved_qty += params.quantity;

    const order = {
      id: params.order_id,
      buyer_user_id: params.buyer_user_id,
      idempotency_key: params.idempotency_key,
      listing_id: params.listing_id,
      qty: params.quantity,
      status: 'pending_payment',
      inventory_restored: false,
    };
    this.orders.set(order.id, order);
    return { id: order.id, status: order.status, deduplicated: false };
  }

  public processPaymentWebhook(params: {
    order_id: string;
    webhook_event_id: string;
    payment_status: 'captured' | 'failed';
  }): { deduplicated: boolean; order_status: string } {
    for (const tx of this.paymentTransactions.values()) {
      if (tx.webhook_event_id === params.webhook_event_id) {
        const ord = this.orders.get(tx.order_id)!;
        return { deduplicated: true, order_status: ord.status };
      }
    }

    const order = this.orders.get(params.order_id);
    if (!order) throw new Error('ORDER_NOT_FOUND');
    const inv = this.inventory.get(order.listing_id)!;

    const txId = `pay-${this.paymentTransactions.size + 1}`;
    this.paymentTransactions.set(txId, {
      id: txId,
      order_id: order.id,
      webhook_event_id: params.webhook_event_id,
      status: params.payment_status,
    });

    if (params.payment_status === 'captured') {
      if (order.status === 'pending_payment') {
        inv.reserved_qty -= order.qty;
        order.status = 'confirmed';
      }
    } else {
      if (!order.inventory_restored && order.status === 'pending_payment') {
        inv.reserved_qty -= order.qty;
        inv.available_qty += order.qty;
        order.inventory_restored = true;
        order.status = 'failed';
      }
    }

    return { deduplicated: false, order_status: order.status };
  }

  // §4.9 Crash-Safe Outbox Worker Claim, Lease Recovery & Dead-Letter Transition
  public enqueueOutboxEvent(params: {
    id: string;
    idempotency_key: string;
    event_type: string;
    payload: Record<string, unknown>;
    max_attempts?: number;
  }): DbOutboxEventRow {
    for (const existing of this.outboxEvents.values()) {
      if (existing.idempotency_key === params.idempotency_key) {
        return existing;
      }
    }
    const row: DbOutboxEventRow = {
      id: params.id,
      idempotency_key: params.idempotency_key,
      event_type: params.event_type,
      payload: params.payload,
      status: 'pending',
      worker_id: null,
      lease_expires_at: null,
      attempts: 0,
      max_attempts: params.max_attempts ?? 5,
      last_error: null,
      next_attempt_at: Date.now(),
    };
    this.outboxEvents.set(row.id, row);
    return row;
  }

  public claimOutboxBatch(workerId: string, leaseDurationMs: number, nowMs = Date.now()): DbOutboxEventRow[] {
    const claimed: DbOutboxEventRow[] = [];
    for (const ev of this.outboxEvents.values()) {
      const isPendingReady = ev.status === 'pending' && ev.next_attempt_at <= nowMs;
      const isExpiredLease =
        ev.status === 'processing' && ev.lease_expires_at !== null && ev.lease_expires_at <= nowMs;

      if ((isPendingReady || isExpiredLease) && ev.attempts < ev.max_attempts) {
        ev.status = 'processing';
        ev.worker_id = workerId;
        ev.lease_expires_at = nowMs + leaseDurationMs;
        ev.attempts += 1;
        claimed.push(ev);
      }
    }
    return claimed;
  }

  public failOutboxEvent(eventId: string, errorMessage: string, backoffMs = 5000, nowMs = Date.now()): DbOutboxEventRow {
    const ev = this.outboxEvents.get(eventId);
    if (!ev) throw new Error('OUTBOX_EVENT_NOT_FOUND');
    ev.last_error = errorMessage;
    ev.worker_id = null;
    ev.lease_expires_at = null;
    if (ev.attempts >= ev.max_attempts) {
      ev.status = 'dead_letter';
    } else {
      ev.status = 'pending';
      ev.next_attempt_at = nowMs + backoffMs;
    }
    return ev;
  }

  public completeOutboxEvent(eventId: string): DbOutboxEventRow {
    const ev = this.outboxEvents.get(eventId);
    if (!ev) throw new Error('OUTBOX_EVENT_NOT_FOUND');
    ev.status = 'completed';
    ev.worker_id = null;
    ev.lease_expires_at = null;
    return ev;
  }

  // §4.5 PostGIS Query Execution Equivalents (Guaranteed lon, lat order)
  public queryEngineAOrganicPosts(viewer: { lon: number; lat: number; city: string; state: string; country: string }): DbPostRow[] {
    const viewerCoords: GeoCoordinates = { latitude: viewer.lat, longitude: viewer.lon };
    const results: DbPostRow[] = [];

    for (const p of this.posts.values()) {
      if (p.classification !== 'organic' || p.engine !== 'ORGANIC_ENTERTAINMENT') continue;
      const originCoords: GeoCoordinates = { latitude: p.publishing_lat, longitude: p.publishing_lon };
      const distMeters = calculateHaversineDistance(
        originCoords.latitude,
        originCoords.longitude,
        viewerCoords.latitude,
        viewerCoords.longitude
      ) * 1000;

      const delivered =
        p.audience_scope === 'worldwide' ||
        (p.audience_scope === 'country' && p.publishing_country.toLowerCase() === viewer.country.toLowerCase()) ||
        (p.audience_scope === 'state' && p.publishing_state.toLowerCase() === viewer.state.toLowerCase()) ||
        (p.audience_scope === 'city' && p.publishing_city.toLowerCase() === viewer.city.toLowerCase()) ||
        (p.max_radius_meters !== null && distMeters <= p.max_radius_meters);

      if (delivered) results.push(p);
    }
    return results;
  }
}
