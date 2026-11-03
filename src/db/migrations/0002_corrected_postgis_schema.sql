-- ============================================================================
-- Migration 0002: Corrected LocalNet Permanent PostgreSQL + PostGIS Schema
-- Incorporates Stage B.1 Corrections (§4.1 through §4.10)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_type') THEN
    CREATE TYPE role_type AS ENUM (
      'user', 'creator', 'business_owner', 'service_provider', 'community_admin', 'platform_admin'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
    CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'revoked');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'distribution_scope_enum') THEN
    CREATE TYPE distribution_scope_enum AS ENUM (
      '5km', '10km', '25km', '40km', 'city', 'state', 'country', 'worldwide'
    );
  END IF;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. IDENTITY & MEDIA ASSETS (Ordered to resolve circular FKs cleanly — §4.2)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY, -- Authoritative Firebase Auth UID
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(32) UNIQUE,
  active_role role_type NOT NULL DEFAULT 'user',
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bucket_category VARCHAR(32) NOT NULL CHECK (
    bucket_category IN ('avatars', 'posts_images', 'videos_original', 'videos_processed', 'business_media', 'temp_uploads')
  ),
  s3_key TEXT NOT NULL UNIQUE,
  cloudfront_url TEXT,
  mime_type VARCHAR(64) NOT NULL,
  magic_bytes_verified BOOLEAN NOT NULL DEFAULT FALSE,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 52428800), -- Max 50 MB
  duration_seconds INTEGER,
  width INTEGER,
  height INTEGER,
  processing_status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (
    processing_status IN ('pending', 'processing', 'ready', 'failed')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id VARCHAR(128) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  avatar_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL, -- §4.2 Explicit FK
  avatar_url TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  preferred_language VARCHAR(8) NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'te', 'hi')),
  home_city VARCHAR(100) NOT NULL DEFAULT 'Kurnool',
  home_state VARCHAR(100) NOT NULL DEFAULT 'Andhra Pradesh',
  home_country VARCHAR(100) NOT NULL DEFAULT 'India',
  home_country_code VARCHAR(8) NOT NULL DEFAULT 'IN',
  followers_count INTEGER NOT NULL DEFAULT 0 CHECK (followers_count >= 0),
  following_count INTEGER NOT NULL DEFAULT 0 CHECK (following_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- §4.2 Explicit FK
  firebase_iat BIGINT NOT NULL,
  ip_hash VARCHAR(64) NOT NULL,
  user_agent VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_exp ON user_sessions (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role role_type NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  approved_by VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
  audit_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS creator_profiles (
  user_id VARCHAR(128) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  primary_category VARCHAR(80) NOT NULL DEFAULT 'Entertainment',
  is_verified_creator BOOLEAN NOT NULL DEFAULT FALSE,
  monetization_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  total_views BIGINT NOT NULL DEFAULT 0 CHECK (total_views >= 0),
  total_watch_seconds BIGINT NOT NULL DEFAULT 0 CHECK (total_watch_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_user_id, blocked_user_id),
  CHECK (blocker_user_id <> blocked_user_id)
);

-- ----------------------------------------------------------------------------
-- 3. SOCIAL & ENGINE A / ENGINE B POSTS (§4.2, §4.3, §4.4, §4.5)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(128) PRIMARY KEY,
  creator_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(32) NOT NULL CHECK (
    content_type IN ('video', 'reel', 'photo', 'multi_photo', 'text', 'story', 'community_update')
  ),
  classification VARCHAR(32) NOT NULL CHECK (
    classification IN ('organic', 'commercial', 'sponsored_creator')
  ),
  engine VARCHAR(32) NOT NULL CHECK (
    engine IN ('ORGANIC_ENTERTAINMENT', 'COMMERCIAL_ADVERTISEMENT')
  ),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL, -- §4.2 Explicit FK
  media_url TEXT NOT NULL,
  media_thumbnail TEXT,
  media_gradient VARCHAR(120),
  aspect_ratio VARCHAR(10) NOT NULL DEFAULT '9:16',
  video_duration_seconds INTEGER,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- IMMUTABLE Publishing Origin (Protected by trg_enforce_post_immutability — §4.3)
  publishing_point GEOGRAPHY(Point, 4326) NOT NULL,
  publishing_city VARCHAR(100) NOT NULL,
  publishing_state VARCHAR(100) NOT NULL,
  publishing_country VARCHAR(100) NOT NULL,
  publishing_country_code VARCHAR(8) NOT NULL DEFAULT 'IN',
  origin_verified BOOLEAN NOT NULL DEFAULT FALSE,

  -- Distribution Scope
  audience_scope distribution_scope_enum NOT NULL DEFAULT 'worldwide',
  max_radius_meters INTEGER,
  target_country VARCHAR(100),

  commercial_metadata JSONB,
  moderation_status VARCHAR(32) NOT NULL DEFAULT 'approved' CHECK (
    moderation_status IN ('approved', 'flagged', 'under_review', 'suspended')
  ),

  -- Transactional Engagement Counters
  likes_count INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count INTEGER NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  shares_count INTEGER NOT NULL DEFAULT 0 CHECK (shares_count >= 0),
  saves_count INTEGER NOT NULL DEFAULT 0 CHECK (saves_count >= 0),
  views_count INTEGER NOT NULL DEFAULT 0 CHECK (views_count >= 0),

  deleted_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- §4.4 & §4.5 Critical Invariant:
  -- 1. Organic posts use ORGANIC_ENTERTAINMENT; if scope is radius-based, max_radius_meters must match.
  -- 2. Commercial / Sponsored posts MUST use COMMERCIAL_ADVERTISEMENT and 0 < max_radius_meters <= 40,000 (40 km).
  CONSTRAINT chk_post_commercial_40km_cap CHECK (
    (
      classification = 'organic'
      AND engine = 'ORGANIC_ENTERTAINMENT'
      AND (
        (audience_scope IN ('city', 'state', 'country', 'worldwide') AND max_radius_meters IS NULL)
        OR (audience_scope = '5km' AND max_radius_meters = 5000)
        OR (audience_scope = '10km' AND max_radius_meters = 10000)
        OR (audience_scope = '25km' AND max_radius_meters = 25000)
        OR (audience_scope = '40km' AND max_radius_meters = 40000)
      )
    )
    OR (
      classification IN ('commercial', 'sponsored_creator')
      AND engine = 'COMMERCIAL_ADVERTISEMENT'
      AND audience_scope IN ('5km', '10km', '25km', '40km')
      AND max_radius_meters IS NOT NULL
      AND max_radius_meters > 0
      AND max_radius_meters <= 40000
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_posts_publishing_point_gist ON posts USING GIST (publishing_point);
CREATE INDEX IF NOT EXISTS idx_posts_feed_composite ON posts (moderation_status, deleted_at, content_type, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_creator_published ON posts (creator_id, published_at DESC);

CREATE TABLE IF NOT EXISTS post_likes (
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id VARCHAR(128) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS post_saves (
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id VARCHAR(128) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR(128) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_created ON post_comments (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS follows (
  follower_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS reel_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR(128) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_user_id VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
  watch_duration_ms INTEGER NOT NULL CHECK (watch_duration_ms >= 0),
  viewer_city VARCHAR(100),
  viewer_country VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. BUSINESSES & VERIFICATION WORKFLOW (§4.1 Corrected)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS businesses (
  id VARCHAR(128) PRIMARY KEY,
  owner_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  phone VARCHAR(32) NOT NULL,
  cover_gradient VARCHAR(120),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  opening_hours VARCHAR(120) NOT NULL,
  -- §4.1: New businesses ALWAYS start unverified (pending review)
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_status approval_status NOT NULL DEFAULT 'pending',
  verified_by_admin_id VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rating NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  review_count INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_business_verified_consistency CHECK (
    (is_verified = FALSE AND verification_status IN ('pending', 'rejected', 'revoked'))
    OR (is_verified = TRUE AND verification_status = 'approved' AND verified_by_admin_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS business_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id VARCHAR(128) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  address_line TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'India',
  country_code VARCHAR(8) NOT NULL DEFAULT 'IN',
  physical_point GEOGRAPHY(Point, 4326) NOT NULL,
  max_service_radius_km NUMERIC(5,2) NOT NULL DEFAULT 15.00 CHECK (
    max_service_radius_km > 0 AND max_service_radius_km <= 40.00
  ),
  -- §4.1: New business locations ALWAYS start unverified
  location_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verification_status approval_status NOT NULL DEFAULT 'pending',
  verified_by_admin_id VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_business_location_verified_consistency CHECK (
    (location_verified = FALSE AND verification_status IN ('pending', 'rejected', 'revoked'))
    OR (location_verified = TRUE AND verification_status = 'approved' AND verified_by_admin_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_business_locations_gist ON business_locations USING GIST (physical_point);

CREATE TABLE IF NOT EXISTS business_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id VARCHAR(128) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  business_location_id UUID NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE,
  submitted_by_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  document_type VARCHAR(64) NOT NULL CHECK (
    document_type IN ('GSTIN', 'SHOP_ACT_LICENSE', 'UDYAM', 'UTILITY_BILL')
  ),
  document_media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  document_s3_key TEXT NOT NULL,
  submitted_point GEOGRAPHY(Point, 4326) NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  reviewed_by_admin_id VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_providers (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(160) NOT NULL,
  service_category VARCHAR(80) NOT NULL,
  city VARCHAR(100) NOT NULL,
  origin_point GEOGRAPHY(Point, 4326) NOT NULL,
  service_radius_km NUMERIC(5,2) NOT NULL CHECK (
    service_radius_km > 0 AND service_radius_km <= 40.00
  ),
  rating NUMERIC(3,2) NOT NULL DEFAULT 4.50,
  review_count INTEGER NOT NULL DEFAULT 0,
  phone VARCHAR(32) NOT NULL,
  experience_years INTEGER NOT NULL DEFAULT 1,
  hourly_rate VARCHAR(64),
  description TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_service_providers_gist ON service_providers USING GIST (origin_point);

-- ----------------------------------------------------------------------------
-- 5. ADVERTISEMENTS & ENGINE B CAMPAIGNS (§4.1, §4.2, §4.3, §4.7 Corrected)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR(128) PRIMARY KEY,
  business_id VARCHAR(128) NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  business_location_id UUID NOT NULL REFERENCES business_locations(id) ON DELETE RESTRICT, -- §4.2 Mandatory FK
  campaign_name VARCHAR(160) NOT NULL,
  headline VARCHAR(255) NOT NULL,
  body_text TEXT NOT NULL,
  call_to_action VARCHAR(32) NOT NULL,
  cta_url TEXT NOT NULL,

  -- §4.1 & §4.3: Copied automatically from approved business_locations via BEFORE INSERT trigger;
  -- cannot be modified by ordinary user updates.
  origin_point GEOGRAPHY(Point, 4326) NOT NULL,
  target_city VARCHAR(100) NOT NULL,
  origin_verified BOOLEAN NOT NULL DEFAULT FALSE,

  -- NON-NEGOTIABLE DB INVARIANT: 0 < selected_radius_km <= 40
  selected_radius_km NUMERIC(5,2) NOT NULL CHECK (
    selected_radius_km > 0 AND selected_radius_km <= 40.00
  ),
  selected_radius_meters INTEGER GENERATED ALWAYS AS (ROUND(selected_radius_km * 1000)::INTEGER) STORED,

  -- Financials in Paise (1 INR = 100 Paise)
  budget_total_paise BIGINT NOT NULL CHECK (budget_total_paise > 0),
  budget_spent_paise BIGINT NOT NULL DEFAULT 0 CHECK (budget_spent_paise >= 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  billing_model VARCHAR(8) NOT NULL CHECK (billing_model IN ('CPM', 'CPC')),
  cost_per_unit_paise BIGINT NOT NULL CHECK (cost_per_unit_paise > 0),

  max_impressions_per_user_day INTEGER NOT NULL DEFAULT 3 CHECK (max_impressions_per_user_day > 0),
  approval_status approval_status NOT NULL DEFAULT 'pending',
  approved_by_admin_id VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,

  impressions_count INTEGER NOT NULL DEFAULT 0 CHECK (impressions_count >= 0),
  clicks_count INTEGER NOT NULL DEFAULT 0 CHECK (clicks_count >= 0),
  conversions_count INTEGER NOT NULL DEFAULT 0 CHECK (conversions_count >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_campaign_budget_not_exceeded CHECK (budget_spent_paise <= budget_total_paise),
  CONSTRAINT chk_campaign_dates CHECK (end_date > start_date),
  -- §4.1: A campaign can ONLY be active or approved if origin_verified = TRUE
  CONSTRAINT chk_campaign_approval_requires_verified_origin CHECK (
    (approval_status <> 'approved' AND is_active = FALSE)
    OR (origin_verified = TRUE AND approval_status = 'approved')
  )
);

CREATE INDEX IF NOT EXISTS idx_campaigns_origin_gist ON campaigns USING GIST (origin_point);
CREATE INDEX IF NOT EXISTS idx_campaigns_active_window ON campaigns (is_active, approval_status, start_date, end_date);

CREATE TABLE IF NOT EXISTS campaign_creatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id VARCHAR(128) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE, -- §4.2 FK
  creative_type VARCHAR(16) NOT NULL CHECK (creative_type IN ('video', 'image')),
  media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL, -- §4.2 FK
  creative_url TEXT,
  creative_gradient VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id VARCHAR(128) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  viewer_user_id VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
  viewer_session_id VARCHAR(128) NOT NULL,
  idempotency_token VARCHAR(128) NOT NULL UNIQUE, -- Prevents duplicate impression billing
  impression_date DATE NOT NULL DEFAULT CURRENT_DATE,
  viewer_distance_km NUMERIC(6,2) NOT NULL CHECK (viewer_distance_km >= 0 AND viewer_distance_km <= 40.00),
  charged_paise BIGINT NOT NULL DEFAULT 0 CHECK (charged_paise >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ad_impressions_freq_cap ON ad_impressions (campaign_id, viewer_user_id, impression_date);

CREATE TABLE IF NOT EXISTS ad_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id VARCHAR(128) NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  impression_id UUID REFERENCES ad_impressions(id) ON DELETE SET NULL,
  viewer_user_id VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
  viewer_session_id VARCHAR(128) NOT NULL,
  idempotency_token VARCHAR(128) NOT NULL UNIQUE, -- Prevents duplicate click billing
  viewer_distance_km NUMERIC(6,2) NOT NULL CHECK (viewer_distance_km >= 0 AND viewer_distance_km <= 40.00),
  charged_paise BIGINT NOT NULL DEFAULT 0 CHECK (charged_paise >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_spend_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id VARCHAR(128) NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  event_type VARCHAR(16) NOT NULL CHECK (event_type IN ('IMPRESSION_CPM', 'CLICK_CPC')),
  reference_event_id UUID NOT NULL UNIQUE,
  amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
  balance_after_paise BIGINT NOT NULL CHECK (balance_after_paise >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 6. MARKETPLACE & TRANSACTIONAL INVENTORY (§4.8 Corrected)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id VARCHAR(128) PRIMARY KEY,
  business_id VARCHAR(128) REFERENCES businesses(id) ON DELETE SET NULL,
  seller_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  seller_name VARCHAR(160) NOT NULL,
  seller_verified BOOLEAN NOT NULL DEFAULT FALSE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(80) NOT NULL,
  price_paise BIGINT NOT NULL CHECK (price_paise >= 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  origin_point GEOGRAPHY(Point, 4326) NOT NULL,
  city_name VARCHAR(100) NOT NULL,
  max_delivery_radius_km NUMERIC(5,2) NOT NULL CHECK (
    max_delivery_radius_km > 0 AND max_delivery_radius_km <= 40.00
  ),
  cover_gradient VARCHAR(120),
  image_url TEXT,
  condition VARCHAR(32) NOT NULL DEFAULT 'new',
  contact_phone VARCHAR(32) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marketplace_origin_gist ON marketplace_listings USING GIST (origin_point);

CREATE TABLE IF NOT EXISTS inventory (
  listing_id VARCHAR(128) PRIMARY KEY REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  available_qty INTEGER NOT NULL DEFAULT 10 CHECK (available_qty >= 0),
  reserved_qty INTEGER NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(128) PRIMARY KEY,
  buyer_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  total_amount_paise BIGINT NOT NULL CHECK (total_amount_paise >= 0),
  delivery_city VARCHAR(100) NOT NULL,
  delivery_address TEXT NOT NULL,
  customer_name VARCHAR(160) NOT NULL,
  customer_phone VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_payment' CHECK (
    status IN ('pending_payment', 'confirmed', 'dispatched', 'out_for_delivery', 'delivered', 'failed', 'cancelled')
  ),
  inventory_restored BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(128) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  listing_id VARCHAR(128) NOT NULL REFERENCES marketplace_listings(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_paise BIGINT NOT NULL CHECK (unit_price_paise >= 0),
  verified_distance_km NUMERIC(5,2) NOT NULL CHECK (verified_distance_km >= 0 AND verified_distance_km <= 40.00)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(128) NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider VARCHAR(32) NOT NULL CHECK (provider IN ('SIMULATED_LOCAL_PROVIDER', 'RAZORPAY', 'STRIPE')),
  provider_webhook_event_id VARCHAR(128) NOT NULL UNIQUE, -- Webhook idempotency
  provider_payment_ref VARCHAR(128) NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
  status VARCHAR(32) NOT NULL CHECK (status IN ('authorized', 'captured', 'failed', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seller_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id VARCHAR(128) NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  buyer_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flash_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id VARCHAR(128) NOT NULL REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 90),
  max_radius_km NUMERIC(5,2) NOT NULL DEFAULT 15.00 CHECK (max_radius_km > 0 AND max_radius_km <= 40.00),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  CHECK (ends_at > starts_at)
);

-- ----------------------------------------------------------------------------
-- 7. GEOGRAPHIC INTEGRITY & SAFE POLYMORPHIC CONTENT CLASSIFICATIONS (§4.2, §4.4, §4.6)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS location_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(128) REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(128) NOT NULL UNIQUE,
  verified_point GEOGRAPHY(Point, 4326) NOT NULL,
  accuracy_meters DOUBLE PRECISION NOT NULL CHECK (accuracy_meters >= 0),
  resolved_city VARCHAR(100) NOT NULL,
  resolved_state VARCHAR(100) NOT NULL,
  resolved_country VARCHAR(100) NOT NULL,
  resolved_country_code VARCHAR(8) NOT NULL,
  verification_source VARCHAR(32) NOT NULL CHECK (
    verification_source IN ('HARDWARE_GPS', 'DEV_CITY_PRESET', 'UNVERIFIED')
  ),
  spoofing_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (spoofing_risk_score BETWEEN 0 AND 100),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_location_verif_user_exp ON location_verifications (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_verif_point_gist ON location_verifications USING GIST (verified_point);

-- §4.2 & §4.4: Explicit nullable foreign keys with an Exclusive Arc CHECK constraint
-- instead of misleading polymorphic string IDs!
CREATE TABLE IF NOT EXISTS content_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR(128) REFERENCES posts(id) ON DELETE CASCADE,
  campaign_id VARCHAR(128) REFERENCES campaigns(id) ON DELETE CASCADE,
  listing_id VARCHAR(128) REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  submitted_classification VARCHAR(32) NOT NULL,
  enforced_classification VARCHAR(32) NOT NULL CHECK (
    enforced_classification IN ('organic', 'commercial', 'sponsored_creator')
  ),
  enforced_engine VARCHAR(32) NOT NULL CHECK (
    enforced_engine IN ('ORGANIC_ENTERTAINMENT', 'COMMERCIAL_ADVERTISEMENT')
  ),
  enforcement_reason TEXT NOT NULL,
  detected_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  reclassified_from_organic BOOLEAN NOT NULL DEFAULT FALSE,
  classifier_version VARCHAR(32) NOT NULL DEFAULT 'v2.1-stage-b1',
  reviewer_user_id VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
  reviewer_decision VARCHAR(32) CHECK (reviewer_decision IN ('upheld_commercial', 'approved_organic_exception', 'suspended')),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Exclusive Arc Constraint: Exactly ONE target FK must be non-null
  CONSTRAINT chk_content_classification_exclusive_target CHECK (
    num_nonnulls(post_id, campaign_id, listing_id) = 1
  )
);

CREATE TABLE IF NOT EXISTS geo_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id VARCHAR(128) NOT NULL,
  item_type VARCHAR(32) NOT NULL,
  engine VARCHAR(32) NOT NULL,
  origin_city VARCHAR(100) NOT NULL,
  viewer_city VARCHAR(100) NOT NULL,
  distance_km NUMERIC(8,2) NOT NULL,
  selected_scope VARCHAR(32) NOT NULL,
  is_delivered BOOLEAN NOT NULL,
  rule_code VARCHAR(64) NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_geo_audit_created ON geo_audit_logs (created_at DESC);

-- ----------------------------------------------------------------------------
-- 8. COMMUNITIES, EVENTS, JOBS, SERVICES & PLATFORM TABLES (§4.9 Corrected)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communities (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  origin_point GEOGRAPHY(Point, 4326) NOT NULL,
  radius_km NUMERIC(6,2) NOT NULL DEFAULT 40.00 CHECK (radius_km > 0),
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  members_count INTEGER NOT NULL DEFAULT 0 CHECK (members_count >= 0),
  icon_name VARCHAR(64) NOT NULL DEFAULT 'Users',
  cover_gradient VARCHAR(120) NOT NULL,
  admin_user_id VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
  admin_name VARCHAR(120) NOT NULL,
  recent_posts_count INTEGER NOT NULL DEFAULT 0,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_members (
  community_id VARCHAR(128) NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(32) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(128) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  organizer VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  event_date VARCHAR(64) NOT NULL,
  event_time VARCHAR(64) NOT NULL,
  venue VARCHAR(200) NOT NULL,
  city VARCHAR(100) NOT NULL,
  origin_point GEOGRAPHY(Point, 4326) NOT NULL,
  description TEXT NOT NULL,
  registered_count INTEGER NOT NULL DEFAULT 0 CHECK (registered_count >= 0),
  is_free BOOLEAN NOT NULL DEFAULT TRUE,
  price_inr INTEGER,
  cover_gradient VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_registrations (
  event_id VARCHAR(128) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS jobs (
  id VARCHAR(128) PRIMARY KEY,
  business_id VARCHAR(128) REFERENCES businesses(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  company_name VARCHAR(160) NOT NULL,
  city VARCHAR(100) NOT NULL,
  origin_point GEOGRAPHY(Point, 4326) NOT NULL,
  category VARCHAR(80) NOT NULL,
  job_type VARCHAR(32) NOT NULL,
  salary_range VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_phone VARCHAR(32) NOT NULL,
  posted_date VARCHAR(64) NOT NULL,
  applicants_count INTEGER NOT NULL DEFAULT 0 CHECK (applicants_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id VARCHAR(128) NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_s3_key TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, user_id)
);

CREATE TABLE IF NOT EXISTS service_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id VARCHAR(128) NOT NULL REFERENCES service_providers(id) ON DELETE RESTRICT,
  customer_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  verified_distance_km NUMERIC(5,2) NOT NULL CHECK (verified_distance_km >= 0 AND verified_distance_km <= 40.00),
  status VARCHAR(32) NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  timestamp_label VARCHAR(64) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  link_tab VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(32) NOT NULL,
  target_id VARCHAR(128) NOT NULL,
  reason VARCHAR(120) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §4.9: Crash-Safe Outbox Events with Lease Expiration & Dead-Letter State
CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(128) NOT NULL UNIQUE,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')
  ),
  worker_id VARCHAR(128),
  lease_expires_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outbox_claimable ON outbox_events (status, next_attempt_at, lease_expires_at)
  WHERE status IN ('pending', 'processing');

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint VARCHAR(128) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id VARCHAR(128) REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(32),
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(128) NOT NULL,
  ticket_reference VARCHAR(128),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 9. TRIGGERS & PRIVILEGED CORRECTION PROCEDURES (§4.1, §4.3, §4.4)
-- ----------------------------------------------------------------------------

-- Private internal table owned by localnet_migrator used ONLY by the SECURITY DEFINER
-- privileged correction procedure (impossible for localnet_app to forge via SET session vars).
CREATE TABLE IF NOT EXISTS _privileged_origin_correction_tokens (
  txid BIGINT PRIMARY KEY,
  target_table VARCHAR(32) NOT NULL,
  target_id VARCHAR(128) NOT NULL,
  admin_user_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
REVOKE ALL ON TABLE _privileged_origin_correction_tokens FROM PUBLIC, localnet_app, localnet_readonly, localnet_test;

-- §4.3 & §4.4: Post Origin Immutability & Commercial Non-Downgrade Trigger
CREATE OR REPLACE FUNCTION trg_enforce_post_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_authorized BOOLEAN := FALSE;
BEGIN
  -- Check if any immutable origin or creator field was altered
  IF ST_AsBinary(NEW.publishing_point) <> ST_AsBinary(OLD.publishing_point)
     OR NEW.publishing_city <> OLD.publishing_city
     OR NEW.publishing_state <> OLD.publishing_state
     OR NEW.publishing_country <> OLD.publishing_country
     OR NEW.publishing_country_code <> OLD.publishing_country_code
     OR NEW.published_at <> OLD.published_at
     OR NEW.creator_id <> OLD.creator_id THEN

    -- Check if the current transaction holds a verified token in the protected migrator table
    SELECT EXISTS (
      SELECT 1 FROM _privileged_origin_correction_tokens
      WHERE txid = txid_current()
        AND target_table = 'posts'
        AND target_id = OLD.id
    ) INTO v_authorized;

    IF NOT v_authorized THEN
      RAISE EXCEPTION 'GEO_SECURITY_VIOLATION: Post publishing origin (point, city, state, country, country_code, published_at, creator_id) is immutable.';
    END IF;
  END IF;

  -- §4.4: Commercial or sponsored content can NEVER be downgraded to organic
  IF OLD.classification IN ('commercial', 'sponsored_creator') AND NEW.classification = 'organic' THEN
    RAISE EXCEPTION 'GEO_SECURITY_VIOLATION: Commercial or sponsored content cannot be downgraded to organic.';
  END IF;

  IF OLD.engine = 'COMMERCIAL_ADVERTISEMENT' AND NEW.engine = 'ORGANIC_ENTERTAINMENT' THEN
    RAISE EXCEPTION 'GEO_SECURITY_VIOLATION: Commercial distribution engine cannot be switched to organic engine.';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_post_immutability ON posts;
CREATE TRIGGER enforce_post_immutability
BEFORE UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION trg_enforce_post_immutability();

-- §4.1 & §4.3: Campaign Origin Copying, Verification Enforcement & Immutability Trigger
CREATE OR REPLACE FUNCTION trg_enforce_campaign_origin_and_verification()
RETURNS TRIGGER AS $$
DECLARE
  v_bus_verified BOOLEAN;
  v_bus_status approval_status;
  v_loc_business_id VARCHAR(128);
  v_loc_point GEOGRAPHY(Point, 4326);
  v_loc_city VARCHAR(100);
  v_loc_verified BOOLEAN;
  v_loc_status approval_status;
  v_authorized BOOLEAN := FALSE;
BEGIN
  -- Fetch parent business and business_location state
  SELECT is_verified, verification_status
    INTO v_bus_verified, v_bus_status
    FROM businesses
   WHERE id = NEW.business_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BUSINESS_NOT_FOUND: Referenced business does not exist or is deleted.';
  END IF;

  SELECT business_id, physical_point, city, location_verified, verification_status
    INTO v_loc_business_id, v_loc_point, v_loc_city, v_loc_verified, v_loc_status
    FROM business_locations
   WHERE id = NEW.business_location_id;

  IF NOT FOUND OR v_loc_business_id <> NEW.business_id THEN
    RAISE EXCEPTION 'INVALID_BUSINESS_LOCATION: business_location_id does not belong to business_id.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Copy authoritative origin from business_locations (ignore any user-supplied coordinates)
    NEW.origin_point := v_loc_point;
    NEW.target_city := v_loc_city;
    NEW.origin_verified := (v_bus_verified AND v_bus_status = 'approved' AND v_loc_verified AND v_loc_status = 'approved');

    -- Cannot insert directly as approved/active unless business + location are verified
    IF (NEW.approval_status = 'approved' OR NEW.is_active = TRUE) AND NOT NEW.origin_verified THEN
      RAISE EXCEPTION 'UNVERIFIED_BUSINESS_ORIGIN: Unverified business or location cannot publish approved or active campaigns.';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Block ordinary modification of campaign origin, business_id, or business_location_id
    IF ST_AsBinary(NEW.origin_point) <> ST_AsBinary(OLD.origin_point)
       OR NEW.target_city <> OLD.target_city
       OR NEW.business_id <> OLD.business_id
       OR NEW.business_location_id <> OLD.business_location_id THEN

      SELECT EXISTS (
        SELECT 1 FROM _privileged_origin_correction_tokens
        WHERE txid = txid_current()
          AND target_table = 'campaigns'
          AND target_id = OLD.id
      ) INTO v_authorized;

      IF NOT v_authorized THEN
        RAISE EXCEPTION 'GEO_SECURITY_VIOLATION: Campaign physical origin and business binding are immutable.';
      END IF;
    END IF;

    -- Re-verify before allowing approval or activation
    IF (NEW.approval_status = 'approved' OR NEW.is_active = TRUE) THEN
      IF NOT (v_bus_verified AND v_bus_status = 'approved' AND v_loc_verified AND v_loc_status = 'approved') THEN
        RAISE EXCEPTION 'UNVERIFIED_BUSINESS_ORIGIN: Campaign cannot be approved or activated while business or location is unverified.';
      END IF;
      NEW.origin_verified := TRUE;
    END IF;

    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_campaign_origin_and_verification ON campaigns;
CREATE TRIGGER enforce_campaign_origin_and_verification
BEFORE INSERT OR UPDATE ON campaigns
FOR EACH ROW EXECUTE FUNCTION trg_enforce_campaign_origin_and_verification();

-- §4.3: Audited Privileged Origin Correction Stored Procedure
CREATE OR REPLACE FUNCTION admin_correct_post_origin(
  p_actor_admin_id VARCHAR(128),
  p_post_id VARCHAR(128),
  p_new_lon DOUBLE PRECISION,
  p_new_lat DOUBLE PRECISION,
  p_new_city VARCHAR(100),
  p_new_state VARCHAR(100),
  p_new_country VARCHAR(100),
  p_new_country_code VARCHAR(8),
  p_ticket_reference VARCHAR(128),
  p_reason TEXT
) RETURNS VOID AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_old_ewkt TEXT;
  v_new_point GEOGRAPHY(Point, 4326);
BEGIN
  -- 1. Verify caller is an approved platform_admin in user_roles
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_actor_admin_id
      AND role = 'platform_admin'
      AND status = 'approved'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'PRIVILEGE_ERROR: Only an approved platform_admin can execute origin correction.';
  END IF;

  IF p_ticket_reference IS NULL OR char_length(trim(p_ticket_reference)) < 3
     OR p_reason IS NULL OR char_length(trim(p_reason)) < 15 THEN
    RAISE EXCEPTION 'AUDIT_ERROR: Privileged origin correction requires a valid ticket_reference and detailed reason (>=15 chars).';
  END IF;

  SELECT ST_AsEWKT(publishing_point) INTO v_old_ewkt FROM posts WHERE id = p_post_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Post % does not exist.', p_post_id;
  END IF;

  v_new_point := ST_SetSRID(ST_MakePoint(p_new_lon, p_new_lat), 4326)::geography;

  -- 2. Insert transaction-scoped authorization token into protected migrator table
  INSERT INTO _privileged_origin_correction_tokens (txid, target_table, target_id, admin_user_id)
  VALUES (txid_current(), 'posts', p_post_id, p_actor_admin_id);

  -- 3. Perform the origin correction
  UPDATE posts
     SET publishing_point = v_new_point,
         publishing_city = p_new_city,
         publishing_state = p_new_state,
         publishing_country = p_new_country,
         publishing_country_code = p_new_country_code
   WHERE id = p_post_id;

  -- 4. Remove token and write mandatory forensic audit log
  DELETE FROM _privileged_origin_correction_tokens WHERE txid = txid_current();

  INSERT INTO audit_logs (actor_user_id, actor_role, action, target_type, target_id, ticket_reference, metadata)
  VALUES (
    p_actor_admin_id,
    'platform_admin',
    'PRIVILEGED_POST_ORIGIN_CORRECTION',
    'post',
    p_post_id,
    p_ticket_reference,
    jsonb_build_object(
      'old_point_ewkt', v_old_ewkt,
      'new_point_ewkt', ST_AsEWKT(v_new_point),
      'new_city', p_new_city,
      'reason', p_reason
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 10. ROLE PERMISSION GRANTS (§4.10 Least-Privilege Separation)
-- ----------------------------------------------------------------------------
-- Operational tables: SELECT, INSERT, UPDATE (and DELETE only on join tables like post_likes, post_saves, follows)
GRANT SELECT, INSERT, UPDATE ON
  users, user_profiles, user_sessions, user_roles, creator_profiles,
  posts, post_comments, reel_views,
  businesses, business_locations, business_verifications, service_providers,
  campaigns, campaign_creatives,
  marketplace_listings, inventory, orders, order_items, seller_conversations, flash_deals,
  location_verifications, content_classifications,
  communities, events, jobs, job_applications, service_bookings,
  notifications, media_assets, moderation_reports, outbox_events, idempotency_keys
TO localnet_app, localnet_test;

GRANT SELECT, INSERT, DELETE ON
  post_likes, post_saves, follows, user_blocks, community_members, event_registrations
TO localnet_app, localnet_test;

-- Append-only financial & security ledgers: localnet_app can ONLY SELECT and INSERT (NEVER UPDATE or DELETE!)
GRANT SELECT, INSERT ON
  ad_impressions, ad_clicks, campaign_spend_records, payment_transactions, geo_audit_logs, audit_logs
TO localnet_app, localnet_test;

-- Read-only analytics role
GRANT SELECT ON
  users, user_profiles, creator_profiles, posts, businesses, business_locations,
  campaigns, ad_impressions, ad_clicks, marketplace_listings, communities, events, jobs, service_providers
TO localnet_readonly;
