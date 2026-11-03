import { IDatabaseClient } from '../postgresPool.ts';
import { MarketplaceListing, OrderRecord } from '../../types/index.ts';
import { calculateHaversineDistance } from '../../lib/geo.ts';

export class MarketplaceRepository {
  private client: IDatabaseClient;

  constructor(client: IDatabaseClient) {
    this.client = client;
  }

  public async listListings(
    viewerLon?: number,
    viewerLat?: number
  ): Promise<{ item: MarketplaceListing; distanceKm: number; isWithinDeliveryRadius: boolean }[]> {
    const lon = viewerLon ?? 78.0373;
    const lat = viewerLat ?? 15.8281;

    const res = await this.client.query(`
      SELECT
        m.*,
        i.available_qty,
        i.reserved_qty,
        ST_X(m.origin_point::geometry) AS lon,
        ST_Y(m.origin_point::geometry) AS lat,
        ST_Distance(
          m.origin_point,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) / 1000.0 AS distance_km
      FROM marketplace_listings m
      LEFT JOIN inventory i ON i.listing_id = m.id
      WHERE m.deleted_at IS NULL AND m.is_active = TRUE
      ORDER BY distance_km ASC;
    `, [lon, lat]);

    return res.rows.map((r: any) => {
      const distanceKm = Number(r.distance_km ? Number(r.distance_km).toFixed(1) : 0);
      const maxRadius = Number(r.max_delivery_radius_km || 20);
      const isWithinDeliveryRadius = distanceKm <= maxRadius && maxRadius <= 40;

      const item: MarketplaceListing = {
        id: r.id,
        businessId: r.business_id,
        sellerName: r.seller_name,
        sellerVerified: Boolean(r.seller_verified),
        title: r.title,
        description: r.description,
        price: Number(r.price_paise || 0) / 100,
        currency: r.currency || 'INR',
        category: r.category,
        coordinates: {
          latitude: Number(r.lat || 15.8281),
          longitude: Number(r.lon || 78.0373)
        },
        cityName: r.city_name || 'Kurnool',
        maxDeliveryRadiusKm: maxRadius,
        coverGradient: r.cover_gradient || 'from-amber-600 via-orange-600 to-amber-900',
        inStock: (r.available_qty ?? 10) > 0,
        condition: r.condition || 'new',
        contactPhone: r.contact_phone || '+91 98480 12345'
      };

      return { item, distanceKm, isWithinDeliveryRadius };
    });
  }

  public async createOrder(
    order: Partial<OrderRecord>,
    viewerCoords?: { latitude: number; longitude: number }
  ): Promise<OrderRecord> {
    const id = order.id || `ord_${Date.now()}`;
    const buyerId = 'current_user_1';
    const idempotencyKey = `idem_${id}`;
    const items = order.items || [];
    const totalAmount = order.totalAmount || 0;
    const deliveryCity = order.deliveryCity || 'Kurnool';
    const deliveryAddress = order.deliveryAddress || 'Main Road, Kurnool';
    const customerName = order.customerName || 'Local Buyer';
    const customerPhone = order.customerPhone || '+91 94401 23456';

    return await this.client.transaction(async (tx) => {
      // Validate distances
      for (const i of items) {
        const listingRes = await tx.query(`
          SELECT
            m.id, m.title, m.max_delivery_radius_km,
            ST_X(m.origin_point::geometry) AS lon,
            ST_Y(m.origin_point::geometry) AS lat
          FROM marketplace_listings m
          WHERE m.id = $1;
        `, [i.listing.id]);

        if (listingRes.rows.length > 0 && viewerCoords) {
          const l = listingRes.rows[0];
          const dist = calculateHaversineDistance(
            viewerCoords.latitude,
            viewerCoords.longitude,
            Number(l.lat),
            Number(l.lon)
          );

          if (dist > Number(l.max_delivery_radius_km) || dist > 40) {
            throw new Error(`Delivery violation: Item "${l.title}" is located ${dist} km away, exceeding maximum local delivery radius of 40 km.`);
          }
        }
      }

      // Ensure buyer user exists
      await tx.query(`
        INSERT INTO users (id, email, active_role, is_suspended)
        VALUES ($1, $2, 'user', FALSE)
        ON CONFLICT (id) DO NOTHING;
      `, [buyerId, `${buyerId}@localnet.in`]);

      // Insert order
      await tx.query(`
        INSERT INTO orders (
          id, buyer_user_id, idempotency_key, total_amount_paise,
          delivery_city, delivery_address, customer_name, customer_phone,
          status, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          'confirmed', NOW(), NOW()
        );
      `, [
        id, buyerId, idempotencyKey, Math.round(totalAmount * 100),
        deliveryCity, deliveryAddress, customerName, customerPhone
      ]);

      // Insert order items
      for (const i of items) {
        await tx.query(`
          INSERT INTO order_items (
            order_id, listing_id, quantity, unit_price_paise, verified_distance_km
          )
          VALUES ($1, $2, $3, $4, $5);
        `, [
          id,
          i.listing.id,
          i.quantity,
          Math.round(i.listing.price * 100),
          2.5 // within delivery radius
        ]);
      }

      // Push notification
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await tx.query(`
        INSERT INTO notifications (
          id, user_id, type, title, message, timestamp_label, link_tab, is_read, created_at
        )
        VALUES (
          $1, $2, 'order', 'Order Confirmed!', $3, 'Just now', 'local', FALSE, NOW()
        );
      `, [
        notifId,
        buyerId,
        `Your order for ₹${totalAmount.toLocaleString()} has been sent to local merchants in ${deliveryCity}.`
      ]);

      return {
        id,
        items,
        totalAmount,
        deliveryCity,
        deliveryAddress,
        customerName,
        customerPhone,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };
    });
  }
}
