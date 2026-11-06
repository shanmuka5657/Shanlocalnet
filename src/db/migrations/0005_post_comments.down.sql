-- ============================================================================
-- Migration 0005 DOWN: Drop Post Comments
-- ============================================================================

BEGIN;

ALTER TABLE posts DROP COLUMN IF EXISTS comment_count;
DROP TABLE IF EXISTS post_comments;

COMMIT;
