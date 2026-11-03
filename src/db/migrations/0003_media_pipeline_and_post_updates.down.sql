-- ============================================================================
-- Migration 0003 Rollback: Revert Media Pipeline & Post Nullable Media Updates
-- ============================================================================

DROP INDEX IF EXISTS idx_media_assets_status;
DROP INDEX IF EXISTS idx_media_assets_owner;
DROP INDEX IF EXISTS idx_posts_media_asset_id;

ALTER TABLE media_assets DROP COLUMN IF EXISTS original_filename;
ALTER TABLE media_assets DROP COLUMN IF EXISTS storage_provider;

ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_size_bytes_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_size_bytes_check CHECK (size_bytes > 0 AND size_bytes <= 52428800);

-- Note: Before enforcing NOT NULL, replace any NULLs with empty string
UPDATE posts SET media_url = '' WHERE media_url IS NULL;
ALTER TABLE posts ALTER COLUMN media_url SET NOT NULL;
