-- ============================================================================
-- Migration 0003: Media Pipeline & Post Nullable Media Updates
-- Allows text-only posts (nullable media_url) and adds storage metadata
-- ============================================================================

-- 1. Make posts.media_url nullable for text-only posts
ALTER TABLE posts ALTER COLUMN media_url DROP NOT NULL;

-- 2. Expand media_assets size check constraint to 100MB (104857600 bytes)
ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_size_bytes_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_size_bytes_check CHECK (size_bytes > 0 AND size_bytes <= 104857600);

-- 3. Add storage provider and original filename to media_assets
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(32) NOT NULL DEFAULT 'local';
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255);

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_posts_media_asset_id ON posts (media_asset_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_owner ON media_assets (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON media_assets (processing_status);
