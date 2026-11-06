-- ============================================================================
-- Migration 0004: Align Duration Columns to NUMERIC(10,3)
-- Root cause: posts.video_duration_seconds and media_assets.duration_seconds
-- are INTEGER, which rejects fractional values such as 0.106667 and 73.450625
-- produced by HTMLMediaElement.duration in browsers.
--
-- Fix: Change both columns to NUMERIC(10,3).
--   - Preserves all existing integer values (they cast losslessly).
--   - Accepts fractional seconds to millisecond precision.
--   - No existing constraints are relaxed.
--   - Unrelated columns are untouched.
--
-- lock_timeout: 3s — aborts rather than waiting if another long transaction
--   holds a conflicting lock. Prevents production table lock queue pile-ups.
-- Transaction: wrapped in BEGIN/COMMIT — both ALTERs succeed or both roll back.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

ALTER TABLE posts
  ALTER COLUMN video_duration_seconds TYPE NUMERIC(10, 3)
  USING video_duration_seconds::numeric(10, 3);

ALTER TABLE media_assets
  ALTER COLUMN duration_seconds TYPE NUMERIC(10, 3)
  USING duration_seconds::numeric(10, 3);

COMMIT;

