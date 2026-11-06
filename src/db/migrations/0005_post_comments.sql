-- ============================================================================
-- Migration 0005: Post Comments
-- Adds comments table so users can comment on any post/short.
-- Each comment belongs to a post and has an author (user_id as text, since
-- the app currently uses string IDs like 'current_user_1').
-- Soft-delete via is_deleted flag preserves comment counts.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

-- Comments table
CREATE TABLE IF NOT EXISTS post_comments (
  id            VARCHAR(64)   PRIMARY KEY,
  post_id       VARCHAR(128)  NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id       TEXT          NOT NULL,
  user_name     TEXT          NOT NULL DEFAULT 'User',
  user_avatar   TEXT,
  body          TEXT          NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  is_deleted    BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index for fast lookup of comments per post
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments (post_id, created_at DESC);

-- Index for a user's own comments (profile page future use)
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON post_comments (user_id, created_at DESC);

-- Add comment_count column to posts for fast display (denormalised counter)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0;

COMMIT;
