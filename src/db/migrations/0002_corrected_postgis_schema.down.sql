-- ============================================================================
-- Rollback 0002: Safe Reverse Order Drop (For Test/Dev Migration Verification)
-- ============================================================================
DROP FUNCTION IF EXISTS admin_correct_post_origin CASCADE;
DROP TRIGGER IF EXISTS enforce_campaign_origin_and_verification ON campaigns;
DROP FUNCTION IF EXISTS trg_enforce_campaign_origin_and_verification CASCADE;
DROP TRIGGER IF EXISTS enforce_post_immutability ON posts;
DROP FUNCTION IF EXISTS trg_enforce_post_immutability CASCADE;
DROP TABLE IF EXISTS _privileged_origin_correction_tokens CASCADE;

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP TABLE IF EXISTS outbox_events CASCADE;
DROP TABLE IF EXISTS moderation_reports CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS service_bookings CASCADE;
DROP TABLE IF EXISTS job_applications CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS event_registrations CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS community_members CASCADE;
DROP TABLE IF EXISTS communities CASCADE;
DROP TABLE IF EXISTS geo_audit_logs CASCADE;
DROP TABLE IF EXISTS content_classifications CASCADE;
DROP TABLE IF EXISTS location_verifications CASCADE;
DROP TABLE IF EXISTS flash_deals CASCADE;
DROP TABLE IF EXISTS seller_conversations CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS marketplace_listings CASCADE;
DROP TABLE IF EXISTS campaign_spend_records CASCADE;
DROP TABLE IF EXISTS ad_clicks CASCADE;
DROP TABLE IF EXISTS ad_impressions CASCADE;
DROP TABLE IF EXISTS campaign_creatives CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS service_providers CASCADE;
DROP TABLE IF EXISTS business_verifications CASCADE;
DROP TABLE IF EXISTS business_locations CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;
DROP TABLE IF EXISTS reel_views CASCADE;
DROP TABLE IF EXISTS follows CASCADE;
DROP TABLE IF EXISTS post_comments CASCADE;
DROP TABLE IF EXISTS post_saves CASCADE;
DROP TABLE IF EXISTS post_likes CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS user_blocks CASCADE;
DROP TABLE IF EXISTS creator_profiles CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS media_assets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS distribution_scope_enum;
DROP TYPE IF EXISTS approval_status;
DROP TYPE IF EXISTS role_type;
