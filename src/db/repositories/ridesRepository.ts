import { IDatabaseClient } from '../postgresPool.ts';
import { RideListing } from '../../types/index.ts';

export class RidesRepository {
  private client: IDatabaseClient;

  constructor(client: IDatabaseClient) {
    this.client = client;
  }

  // ── Row → RideListing ────────────────────────────────────────────────────
  private rowToRide(row: any): RideListing {
    const totalSeats = Number(row.total_seats) || 1;
    const availableSeats = Number(row.available_seats) || 0;
    return {
      id: row.id,
      driverId: row.driver_id,
      driverName: row.driver_name,
      driverAvatar: row.driver_avatar || '',
      driverRating: parseFloat(row.driver_rating) || 5.0,
      driverTotalRides: Number(row.driver_total_rides) || 0,
      driverVerified: Boolean(row.driver_verified),
      fromCity: row.from_city,
      fromArea: row.from_area || row.from_city,
      fromLat: parseFloat(row.from_lat) || 0,
      fromLon: parseFloat(row.from_lon) || 0,
      toCity: row.to_city,
      toArea: row.to_area || row.to_city,
      toLat: parseFloat(row.to_lat) || 0,
      toLon: parseFloat(row.to_lon) || 0,
      waypoints: Array.isArray(row.waypoints) ? row.waypoints : [],
      departureDate: row.departure_date instanceof Date
        ? row.departure_date.toISOString().split('T')[0]
        : String(row.departure_date || '').split('T')[0],
      departureTime: row.departure_time
        ? String(row.departure_time).substring(0, 5)
        : '00:00',
      estimatedDuration: row.estimated_duration || '',
      distanceKm: parseFloat(row.distance_km) || 0,
      totalSeats,
      availableSeats,
      pricePerSeat: Number(row.price_per_seat) || 0,
      vehicleType: (row.vehicle_type as any) || 'car',
      vehicleModel: row.vehicle_model || '',
      vehicleColor: row.vehicle_color || '',
      vehicleNumber: row.vehicle_number || undefined,
      preferences: Array.isArray(row.preferences) ? row.preferences : [],
      notes: row.notes || '',
      status: (row.status as any) || 'active',
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at || new Date().toISOString()),
      bookedSeats: totalSeats - availableSeats,
    };
  }

  // ── List all available rides (with optional search filters) ──────────────
  async listRides(filters: {
    fromCity?: string;
    toCity?: string;
    date?: string;
    minSeats?: number;
  } = {}): Promise<RideListing[]> {
    const params: any[] = [];
    let idx = 1;
    let where = `WHERE status IN ('active', 'full') AND departure_date >= CURRENT_DATE`;

    if (filters.fromCity) {
      where += ` AND LOWER(from_city) LIKE LOWER($${idx++})`;
      params.push(`%${filters.fromCity}%`);
    }
    if (filters.toCity) {
      where += ` AND LOWER(to_city) LIKE LOWER($${idx++})`;
      params.push(`%${filters.toCity}%`);
    }
    if (filters.date) {
      where += ` AND departure_date = $${idx++}`;
      params.push(filters.date);
    }
    if (filters.minSeats && filters.minSeats > 1) {
      where += ` AND available_seats >= $${idx++}`;
      params.push(filters.minSeats);
    }

    const sql = `
      SELECT * FROM rides
      ${where}
      ORDER BY departure_date ASC, departure_time ASC
      LIMIT 100
    `;

    const result = await this.client.query(sql, params);
    return result.rows.map((r: any) => this.rowToRide(r));
  }

  // ── Create a new ride posting ─────────────────────────────────────────────
  async createRide(ride: RideListing): Promise<RideListing> {
    // Ensure driver user record exists
    await this.client.query(
      `INSERT INTO users (id, email, active_role, is_suspended)
       VALUES ($1, $2, 'user', FALSE)
       ON CONFLICT (id) DO NOTHING;`,
      [ride.driverId, `${ride.driverId}@localnet.in`]
    );

    const result = await this.client.query(
      `INSERT INTO rides (
         id, driver_id, driver_name, driver_avatar,
         driver_rating, driver_total_rides, driver_verified,
         from_city, from_area, from_lat, from_lon,
         to_city, to_area, to_lat, to_lon,
         waypoints, departure_date, departure_time,
         estimated_duration, distance_km,
         total_seats, available_seats, price_per_seat,
         vehicle_type, vehicle_model, vehicle_color, vehicle_number,
         preferences, notes, status
       ) VALUES (
         $1,$2,$3,$4,
         $5,$6,$7,
         $8,$9,$10,$11,
         $12,$13,$14,$15,
         $16,$17,$18,
         $19,$20,
         $21,$22,$23,
         $24,$25,$26,$27,
         $28,$29,$30
       )
       RETURNING *;`,
      [
        ride.id,
        ride.driverId,
        ride.driverName,
        ride.driverAvatar || null,
        ride.driverRating || 5.0,
        ride.driverTotalRides || 0,
        ride.driverVerified || false,
        ride.fromCity,
        ride.fromArea || ride.fromCity,
        ride.fromLat || 0,
        ride.fromLon || 0,
        ride.toCity,
        ride.toArea || ride.toCity,
        ride.toLat || null,
        ride.toLon || null,
        ride.waypoints || [],
        ride.departureDate,
        ride.departureTime,
        ride.estimatedDuration || null,
        ride.distanceKm || null,
        ride.totalSeats,
        ride.availableSeats,
        ride.pricePerSeat,
        ride.vehicleType,
        ride.vehicleModel,
        ride.vehicleColor || '',
        ride.vehicleNumber || null,
        ride.preferences || [],
        ride.notes || '',
        ride.status || 'active',
      ]
    );

    return this.rowToRide(result.rows[0]);
  }

  // ── Book seats on a ride (atomic seat decrement) ─────────────────────────
  async bookSeat(params: {
    rideId: string;
    passengerId: string;
    passengerName: string;
    passengerAvatar: string;
    seatsBooked: number;
  }): Promise<{ ride: RideListing; bookingId: string }> {
    const { rideId, passengerId, passengerName, passengerAvatar, seatsBooked } = params;

    // Ensure passenger user record exists
    await this.client.query(
      `INSERT INTO users (id, email, active_role, is_suspended)
       VALUES ($1, $2, 'user', FALSE)
       ON CONFLICT (id) DO NOTHING;`,
      [passengerId, `${passengerId}@localnet.in`]
    );

    // Atomically decrement seats; auto-mark 'full' when seats reach 0
    const rideResult = await this.client.query(
      `UPDATE rides
       SET
         available_seats = GREATEST(0, available_seats - $1),
         status = CASE
           WHEN (available_seats - $1) <= 0 THEN 'full'
           ELSE 'active'
         END,
         updated_at = NOW()
       WHERE id = $2
         AND status = 'active'
         AND available_seats >= $1
       RETURNING *;`,
      [seatsBooked, rideId]
    );

    if (!rideResult.rows.length) {
      throw new Error('Ride is not available or does not have enough seats left.');
    }

    const totalAmount = seatsBooked * Number(rideResult.rows[0].price_per_seat);
    const bookingId = `bkg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await this.client.query(
      `INSERT INTO ride_bookings
         (id, ride_id, passenger_id, passenger_name, passenger_avatar, seats_booked, total_amount, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed');`,
      [bookingId, rideId, passengerId, passengerName, passengerAvatar || '', seatsBooked, totalAmount]
    );

    return { ride: this.rowToRide(rideResult.rows[0]), bookingId };
  }

  // ── Get rides posted by a specific driver ────────────────────────────────
  async getRidesByDriver(driverId: string): Promise<RideListing[]> {
    const result = await this.client.query(
      `SELECT
         r.*,
         COALESCE(
           (SELECT SUM(seats_booked) FROM ride_bookings WHERE ride_id = r.id AND status = 'confirmed'),
           0
         ) AS confirmed_bookings
       FROM rides r
       WHERE r.driver_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50;`,
      [driverId]
    );
    return result.rows.map((row: any) => ({
      ...this.rowToRide(row),
      bookedSeats: Number(row.confirmed_bookings) || 0,
      availableSeats: Number(row.total_seats) - Number(row.confirmed_bookings || 0),
    }));
  }

  // ── Cancel a ride ─────────────────────────────────────────────────────────
  async cancelRide(rideId: string, driverId: string): Promise<void> {
    const result = await this.client.query(
      `UPDATE rides SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND driver_id = $2 RETURNING id;`,
      [rideId, driverId]
    );
    if (!result.rows.length) {
      throw new Error('Ride not found or you are not the driver.');
    }
  }
}
