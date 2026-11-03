import { IDatabaseClient } from '../postgresPool.ts';
import { BusinessProfile } from '../../types/index.ts';

export class BusinessesRepository {
  private client: IDatabaseClient;

  constructor(client: IDatabaseClient) {
    this.client = client;
  }

  public async createBusiness(biz: Partial<BusinessProfile>): Promise<BusinessProfile> {
    const id = biz.id || `biz_${Date.now()}`;
    const ownerId = biz.ownerId || 'current_user_1';
    const name = biz.name || 'New Local Business';
    const category = biz.category || 'Local Services';
    const description = biz.description || 'Local merchant registered on LocalNet.';
    const phone = biz.phone || '+91 8518 000000';
    const openingHours = biz.openingHours || '9:00 AM - 8:00 PM';
    const coverGradient = biz.coverGradient || 'from-emerald-600 to-teal-900';
    const tags = biz.tags || [category];

    const lon = biz.coordinates?.longitude || 78.0373;
    const lat = biz.coordinates?.latitude || 15.8281;
    const address = biz.address || 'Main Road';
    const city = biz.city || 'Kurnool';
    const state = biz.state || 'Andhra Pradesh';
    const country = biz.country || 'India';

    // Ensure owner user exists
    await this.client.query(`
      INSERT INTO users (id, email, active_role, is_suspended)
      VALUES ($1, $2, 'business_owner', FALSE)
      ON CONFLICT (id) DO NOTHING;
    `, [ownerId, `${ownerId}@localnet.in`]);

    // Insert business
    await this.client.query(`
      INSERT INTO businesses (
        id, owner_user_id, name, category, description, phone,
        cover_gradient, tags, opening_hours, is_verified, verification_status,
        rating, review_count, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, FALSE, 'pending',
        5.00, 1, NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    `, [
      id, ownerId, name, category, description, phone,
      coverGradient, JSON.stringify(tags), openingHours
    ]);

    // Insert primary location
    await this.client.query(`
      INSERT INTO business_locations (
        business_id, is_primary, address_line, city, state, country, country_code,
        physical_point, max_service_radius_km, location_verified, verification_status,
        created_at, updated_at
      )
      VALUES (
        $1, TRUE, $2, $3, $4, $5, 'IN',
        ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, 25.00, FALSE, 'pending',
        NOW(), NOW()
      );
    `, [id, address, city, state, country, lon, lat]);

    return {
      id,
      ownerId,
      name,
      category,
      address,
      city,
      state,
      country,
      coordinates: { latitude: lat, longitude: lon },
      isVerified: false,
      phone,
      rating: 5.0,
      reviewCount: 1,
      coverGradient,
      tags,
      description,
      openingHours
    };
  }

  public async listAll(viewerLon?: number, viewerLat?: number): Promise<BusinessProfile[]> {
    let queryStr = `
      SELECT
        b.id,
        b.owner_user_id,
        b.name,
        b.category,
        b.description,
        b.phone,
        b.cover_gradient,
        b.tags,
        b.opening_hours,
        b.is_verified,
        b.rating,
        b.review_count,
        bl.address_line,
        bl.city,
        bl.state,
        bl.country,
        bl.max_service_radius_km,
        bl.location_verified,
        ST_X(bl.physical_point::geometry) AS lon,
        ST_Y(bl.physical_point::geometry) AS lat
      FROM businesses b
      LEFT JOIN business_locations bl ON bl.business_id = b.id AND bl.is_primary = TRUE
      WHERE b.deleted_at IS NULL
      ORDER BY b.created_at DESC;
    `;

    const res = await this.client.query(queryStr);
    return res.rows.map((r: any) => ({
      id: r.id,
      ownerId: r.owner_user_id,
      name: r.name,
      category: r.category,
      address: r.address_line || 'Main Road',
      city: r.city || 'Kurnool',
      state: r.state || 'Andhra Pradesh',
      country: r.country || 'India',
      coordinates: {
        latitude: Number(r.lat || 15.8281),
        longitude: Number(r.lon || 78.0373)
      },
      isVerified: Boolean(r.is_verified),
      phone: r.phone,
      rating: Number(r.rating || 5.0),
      reviewCount: Number(r.review_count || 1),
      coverGradient: r.cover_gradient || 'from-emerald-600 to-teal-900',
      tags: Array.isArray(r.tags) ? r.tags : typeof r.tags === 'string' ? JSON.parse(r.tags) : [r.category],
      description: r.description,
      openingHours: r.opening_hours || '9:00 AM - 8:00 PM'
    }));
  }

  public async getBusinessById(businessId: string): Promise<BusinessProfile | null> {
    const list = await this.listAll();
    return list.find(b => b.id === businessId) || null;
  }

  public async verifyBusiness(businessId: string, adminId: string): Promise<void> {
    await this.client.query(`
      UPDATE businesses
      SET
        is_verified = TRUE,
        verification_status = 'approved',
        verified_by_admin_id = $1,
        verified_at = NOW(),
        updated_at = NOW()
      WHERE id = $2;
    `, [adminId, businessId]);

    await this.client.query(`
      UPDATE business_locations
      SET
        location_verified = TRUE,
        verification_status = 'approved',
        verified_by_admin_id = $1,
        verified_at = NOW(),
        updated_at = NOW()
      WHERE business_id = $2;
    `, [adminId, businessId]);
  }
}
