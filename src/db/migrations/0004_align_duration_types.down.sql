-- ============================================================================
-- Migration 0004 DOWN: Revert duration columns from NUMERIC(10,3) to INTEGER
--
-- WARNING: This rollback is LOSSY for any records whose duration_seconds or
-- video_duration_seconds has fractional parts.  Fractional values are archived
-- into _duration_rollback_precision_archive BEFORE the column type is reverted.
-- Integer values and NULLs are unaffected.
--
-- Roll-forward recovery:
--   After re-running migration 0004 UP, restore exact fractional values with:
--     UPDATE posts p
--       SET video_duration_seconds = a.exact_duration::numeric(10,3)
--     FROM _duration_rollback_precision_archive a
--     WHERE a.table_name = 'posts' AND a.record_id = p.id;
--
--     UPDATE media_assets m
--       SET duration_seconds = a.exact_duration::numeric(10,3)
--     FROM _duration_rollback_precision_archive a
--     WHERE a.table_name = 'media_assets' AND a.record_id = m.id::text;
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '3s';

-- Step 1: Archive any fractional values before precision is lost.
CREATE TABLE IF NOT EXISTS _duration_rollback_precision_archive (
  table_name  VARCHAR(64)    NOT NULL,
  record_id   VARCHAR(128)   NOT NULL,  -- VARCHAR: holds both posts.id (VARCHAR) and media_assets.id (UUID as text)
  exact_duration NUMERIC(10, 3) NOT NULL,
  archived_at TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  PRIMARY KEY (table_name, record_id)
);

-- Archive fractional post durations (posts.id is VARCHAR).
INSERT INTO _duration_rollback_precision_archive (table_name, record_id, exact_duration)
SELECT 'posts', id, video_duration_seconds
FROM posts
WHERE video_duration_seconds IS NOT NULL
  AND video_duration_seconds <> TRUNC(video_duration_seconds)
ON CONFLICT (table_name, record_id)
  DO UPDATE SET exact_duration = EXCLUDED.exact_duration, archived_at = NOW();

-- Archive fractional media asset durations (media_assets.id is UUID → cast to text).
INSERT INTO _duration_rollback_precision_archive (table_name, record_id, exact_duration)
SELECT 'media_assets', id::text, duration_seconds
FROM media_assets
WHERE duration_seconds IS NOT NULL
  AND duration_seconds <> TRUNC(duration_seconds)
ON CONFLICT (table_name, record_id)
  DO UPDATE SET exact_duration = EXCLUDED.exact_duration, archived_at = NOW();

-- Step 2: Revert column types.
-- Sub-second videos (0 < v < 1) are rounded up to 1 to avoid storing 0 in NOT NULL contexts.
ALTER TABLE posts
  ALTER COLUMN video_duration_seconds TYPE INTEGER
  USING CASE
    WHEN video_duration_seconds IS NULL THEN NULL
    WHEN video_duration_seconds > 0 AND video_duration_seconds < 1 THEN 1
    ELSE ROUND(video_duration_seconds)::integer
  END;

ALTER TABLE media_assets
  ALTER COLUMN duration_seconds TYPE INTEGER
  USING CASE
    WHEN duration_seconds IS NULL THEN NULL
    WHEN duration_seconds > 0 AND duration_seconds < 1 THEN 1
    ELSE ROUND(duration_seconds)::integer
  END;

COMMIT;

