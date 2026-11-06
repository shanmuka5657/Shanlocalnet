-- Migration 0006: Rides (BlaBlaCar-style carpooling) tables
-- Riders post journey offers; passengers book available seats.

CREATE TABLE IF NOT EXISTS rides (
  id                  VARCHAR(128)       PRIMARY KEY,
  driver_id           VARCHAR(128)       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  driver_name         VARCHAR(160)       NOT NULL,
  driver_avatar       TEXT,
  driver_rating       NUMERIC(3,2)       NOT NULL DEFAULT 5.00,
  driver_total_rides  INTEGER            NOT NULL DEFAULT 0,
  driver_verified     BOOLEAN            NOT NULL DEFAULT FALSE,

  from_city           VARCHAR(100)       NOT NULL,
  from_area           VARCHAR(200)       NOT NULL DEFAULT '',
  from_lat            NUMERIC(10,6)      NOT NULL DEFAULT 0,
  from_lon            NUMERIC(10,6)      NOT NULL DEFAULT 0,

  to_city             VARCHAR(100)       NOT NULL,
  to_area             VARCHAR(200)       NOT NULL DEFAULT '',
  to_lat              NUMERIC(10,6),
  to_lon              NUMERIC(10,6),

  waypoints           TEXT[]             NOT NULL DEFAULT '{}',

  departure_date      DATE               NOT NULL,
  departure_time      TIME               NOT NULL,
  estimated_duration  VARCHAR(20),
  distance_km         NUMERIC(8,2),

  total_seats         INTEGER            NOT NULL DEFAULT 3 CHECK (total_seats >= 1 AND total_seats <= 20),
  available_seats     INTEGER            NOT NULL DEFAULT 3 CHECK (available_seats >= 0),
  price_per_seat      INTEGER            NOT NULL CHECK (price_per_seat >= 0),

  vehicle_type        VARCHAR(20)        NOT NULL DEFAULT 'car',
  vehicle_model       VARCHAR(100)       NOT NULL,
  vehicle_color       VARCHAR(50)        NOT NULL DEFAULT '',
  vehicle_number      VARCHAR(30),

  preferences         TEXT[]             NOT NULL DEFAULT '{}',
  notes               TEXT               NOT NULL DEFAULT '',

  status              VARCHAR(20)        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','full','completed','cancelled')),

  created_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ride_bookings (
  id               VARCHAR(128)  PRIMARY KEY,
  ride_id          VARCHAR(128)  NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  passenger_id     VARCHAR(128)  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  passenger_name   VARCHAR(160)  NOT NULL,
  passenger_avatar TEXT,
  seats_booked     INTEGER       NOT NULL DEFAULT 1 CHECK (seats_booked >= 1),
  total_amount     INTEGER       NOT NULL CHECK (total_amount >= 0),
  status           VARCHAR(20)   NOT NULL DEFAULT 'confirmed'
                     CHECK (status IN ('pending','confirmed','cancelled')),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rides_status      ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_departure   ON rides(departure_date, departure_time);
CREATE INDEX IF NOT EXISTS idx_rides_from_city   ON rides(LOWER(from_city));
CREATE INDEX IF NOT EXISTS idx_rides_to_city     ON rides(LOWER(to_city));
CREATE INDEX IF NOT EXISTS idx_rides_driver      ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_ride_bookings_ride      ON ride_bookings(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_bookings_passenger ON ride_bookings(passenger_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON rides           TO localnet_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ride_bookings   TO localnet_app;
GRANT SELECT ON rides         TO localnet_readonly;
GRANT SELECT ON ride_bookings TO localnet_readonly;
