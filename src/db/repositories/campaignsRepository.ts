import { IDatabaseClient, POSTGIS_QUERIES } from '../postgresPool.ts';
import { AdCampaign, EligibilityResult, ViewerLocation } from '../../types/index.ts';
import { calculateHaversineDistance, evaluateCommercialEligibility, MAXIMUM_COMMERCIAL_RADIUS_KM } from '../../lib/geo.ts';

export class CampaignsRepository {
  private client: IDatabaseClient;

  constructor(client: IDatabaseClient) {
    this.client = client;
  }

  public async createCampaign(c: Partial<AdCampaign>): Promise<AdCampaign> {
    const id = c.id || `camp_${Date.now()}`;
    const businessId = c.businessId || 'biz_kurnool_biryani';
    const radius = Number(c.selectedRadiusKm || 25);

    if (radius <= 0 || radius > MAXIMUM_COMMERCIAL_RADIUS_KM) {
      throw new Error(`Commercial campaign radius violation: attempted ${radius} km exceeds hard database ceiling of ${MAXIMUM_COMMERCIAL_RADIUS_KM} km.`);
    }

    const lon = c.targetCoordinates?.longitude || 78.0373;
    const lat = c.targetCoordinates?.latitude || 15.8281;
    const city = c.targetCity || 'Kurnool';
    const budgetTotalPaise = (c.budget?.total || 2000) * 100;
    const costPerUnitPaise = c.budget?.model === 'CPC' ? 600 : 5000;

    // Retrieve or create business location
    let locRes = await this.client.query(
      'SELECT id FROM business_locations WHERE business_id = $1 LIMIT 1;',
      [businessId]
    );

    let locationId = locRes.rows[0]?.id;
    if (!locationId) {
      const newLoc = await this.client.query(`
        INSERT INTO business_locations (
          business_id, is_primary, address_line, city, state, country,
          physical_point, max_service_radius_km, location_verified, verification_status
        )
        VALUES (
          $1, TRUE, 'Main Road', $2, 'Andhra Pradesh', 'India',
          ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, TRUE, 'approved'
        )
        RETURNING id;
      `, [businessId, city, lon, lat, radius]);
      locationId = newLoc.rows[0]?.id;
    }

    await this.client.query(`
      INSERT INTO campaigns (
        id, business_id, business_location_id, campaign_name, headline, body_text,
        call_to_action, cta_url, origin_point, target_city, origin_verified,
        selected_radius_km, budget_total_paise, budget_spent_paise, currency,
        billing_model, cost_per_unit_paise, max_impressions_per_user_day,
        approval_status, is_active, start_date, end_date, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography, $11, TRUE,
        $12, $13, 0, 'INR',
        $14, $15, 3,
        'approved', TRUE, NOW(), NOW() + INTERVAL '30 days', NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    `, [
      id,
      businessId,
      locationId,
      c.campaignName || 'Local Campaign',
      c.headline || 'Local Offer',
      c.bodyText || '',
      c.callToAction || 'VISIT_STORE',
      c.ctaUrl || 'https://localnet.example.com',
      lon,
      lat,
      city,
      radius,
      budgetTotalPaise,
      c.budget?.model || 'CPM',
      costPerUnitPaise
    ]);

    return {
      id,
      businessId,
      businessName: c.businessName || 'Local Business',
      businessCategory: c.businessCategory || 'Local Business',
      campaignName: c.campaignName || 'Local Campaign',
      headline: c.headline || 'Local Offer',
      bodyText: c.bodyText || '',
      creativeType: 'image',
      creativeGradient: 'from-amber-600 via-rose-700 to-slate-900',
      callToAction: c.callToAction || 'VISIT_STORE',
      ctaUrl: c.ctaUrl || 'https://localnet.example.com',
      targetCoordinates: { latitude: lat, longitude: lon },
      targetCity: city,
      selectedRadiusKm: radius,
      budget: {
        total: c.budget?.total || 2000,
        spent: 0,
        currency: 'INR',
        model: c.budget?.model || 'CPM',
        costPerUnit: c.budget?.model === 'CPC' ? 6 : 50
      },
      metrics: {
        impressions: 0,
        eligibleViewersReached: 0,
        clicks: 0,
        ctr: 0,
        conversions: 0
      },
      approvalStatus: 'approved',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      isActive: true,
      createdAt: new Date().toISOString()
    };
  }

  public async getCommercialFeed(
    viewer: ViewerLocation | null
  ): Promise<{ ad: AdCampaign; eligibility: EligibilityResult }[]> {
    const lon = viewer?.coords.longitude ?? 78.0373;
    const lat = viewer?.coords.latitude ?? 15.8281;

    const res = await this.client.query(`
      SELECT
        c.*,
        b.name AS business_name,
        b.category AS business_category,
        b.is_verified AS business_verified,
        ST_X(c.origin_point::geometry) AS lon,
        ST_Y(c.origin_point::geometry) AS lat,
        ST_Distance(
          c.origin_point,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000.0 AS distance_km
      FROM campaigns c
      JOIN businesses b ON b.id = c.business_id AND b.deleted_at IS NULL
      WHERE c.is_active = TRUE
        AND c.approval_status = 'approved'
        AND c.budget_spent_paise < c.budget_total_paise
        AND c.selected_radius_km <= 40.00
      ORDER BY distance_km ASC;
    `, [lon, lat]);

    return res.rows.map((r: any) => {
      const ad = this.mapRowToCampaign(r);
      const eligibility = evaluateCommercialEligibility(viewer, ad);
      return { ad, eligibility };
    });
  }

  public async listAll(): Promise<AdCampaign[]> {
    const res = await this.client.query(`
      SELECT
        c.*,
        b.name AS business_name,
        b.category AS business_category,
        ST_X(c.origin_point::geometry) AS lon,
        ST_Y(c.origin_point::geometry) AS lat
      FROM campaigns c
      JOIN businesses b ON b.id = c.business_id AND b.deleted_at IS NULL
      ORDER BY c.created_at DESC;
    `);
    return res.rows.map((r: any) => this.mapRowToCampaign(r));
  }

  public async recordImpression(campaignId: string): Promise<number> {
    try {
      await this.client.query(`
        UPDATE campaigns
        SET impressions_count = impressions_count + 1, updated_at = NOW()
        WHERE id = $1;
      `, [campaignId]);
      const res = await this.client.query('SELECT impressions_count FROM campaigns WHERE id = $1;', [campaignId]);
      return Number(res.rows?.[0]?.impressions_count ?? 1);
    } catch {
      return 1;
    }
  }

  private mapRowToCampaign(r: any): AdCampaign {
    const budgetTotal = Number(r.budget_total_paise || 200000) / 100;
    const budgetSpent = Number(r.budget_spent_paise || 0) / 100;
    const impressions = Number(r.impressions_count || 0);
    const clicks = Number(r.clicks_count || 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    return {
      id: r.id,
      businessId: r.business_id,
      businessName: r.business_name || 'Registered Business',
      businessCategory: r.business_category || 'Local Business',
      campaignName: r.campaign_name,
      headline: r.headline,
      bodyText: r.body_text,
      creativeType: 'image',
      creativeGradient: 'from-amber-600 via-rose-700 to-slate-900',
      callToAction: r.call_to_action,
      ctaUrl: r.cta_url,
      targetCoordinates: {
        latitude: Number(r.lat || 15.8281),
        longitude: Number(r.lon || 78.0373)
      },
      targetCity: r.target_city,
      selectedRadiusKm: Number(r.selected_radius_km || 25),
      budget: {
        total: budgetTotal,
        spent: budgetSpent,
        currency: r.currency || 'INR',
        model: r.billing_model || 'CPM',
        costPerUnit: Number(r.cost_per_unit_paise || 5000) / 100
      },
      metrics: {
        impressions,
        eligibleViewersReached: impressions,
        clicks,
        ctr: Number(ctr.toFixed(2)),
        conversions: Number(r.conversions_count || 0)
      },
      approvalStatus: r.approval_status,
      startDate: (r.start_date || new Date()).toString(),
      endDate: (r.end_date || new Date()).toString(),
      isActive: Boolean(r.is_active),
      createdAt: (r.created_at || new Date()).toString()
    };
  }
}

