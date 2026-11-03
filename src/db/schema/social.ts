import {
  pgTable,
  pgEnum,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  uuid,
  jsonb,
  primaryKey,
  customType
} from 'drizzle-orm/pg-core';
import { users } from './identity.ts';
import { mediaAssets } from './platform.ts';

/**
 * Custom PostGIS GEOGRAPHY(Point, 4326) column type for Drizzle ORM.
 * Note: Always pass (longitude, latitude) order to ST_MakePoint(lon, lat).
 */
export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geography(Point, 4326)';
  }
});

export const distributionScopeEnum = pgEnum('distribution_scope_enum', [
  '5km',
  '10km',
  '25km',
  '40km',
  'city',
  'state',
  'country',
  'worldwide'
]);

export const posts = pgTable('posts', {
  id: varchar('id', { length: 128 }).primaryKey(),
  creatorId: varchar('creator_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  contentType: varchar('content_type', { length: 32 }).notNull(),
  classification: varchar('classification', { length: 32 }).notNull(),
  engine: varchar('engine', { length: 32 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  mediaAssetId: uuid('media_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
  mediaUrl: text('media_url').notNull(),
  mediaThumbnail: text('media_thumbnail'),
  mediaGradient: varchar('media_gradient', { length: 120 }),
  aspectRatio: varchar('aspect_ratio', { length: 10 }).notNull().default('9:16'),
  videoDurationSeconds: integer('video_duration_seconds'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),

  // Immutable Publishing Origin (§4.3)
  publishingPoint: geographyPoint('publishing_point').notNull(),
  publishingCity: varchar('publishing_city', { length: 100 }).notNull(),
  publishingState: varchar('publishing_state', { length: 100 }).notNull(),
  publishingCountry: varchar('publishing_country', { length: 100 }).notNull(),
  publishingCountryCode: varchar('publishing_country_code', { length: 8 }).notNull().default('IN'),
  originVerified: boolean('origin_verified').notNull().default(false),

  // Audience Scope
  audienceScope: distributionScopeEnum('audience_scope').notNull().default('worldwide'),
  maxRadiusMeters: integer('max_radius_meters'),
  targetCountry: varchar('target_country', { length: 100 }),

  commercialMetadata: jsonb('commercial_metadata'),
  moderationStatus: varchar('moderation_status', { length: 32 }).notNull().default('approved'),

  likesCount: integer('likes_count').notNull().default(0),
  commentsCount: integer('comments_count').notNull().default(0),
  sharesCount: integer('shares_count').notNull().default(0),
  savesCount: integer('saves_count').notNull().default(0),
  viewsCount: integer('views_count').notNull().default(0),

  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const postLikes = pgTable(
  'post_likes',
  {
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: varchar('post_id', { length: 128 })
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [primaryKey({ columns: [table.userId, table.postId] })]
);

export const postSaves = pgTable(
  'post_saves',
  {
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: varchar('post_id', { length: 128 })
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [primaryKey({ columns: [table.userId, table.postId] })]
);

export const postComments = pgTable('post_comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: varchar('post_id', { length: 128 })
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const follows = pgTable(
  'follows',
  {
    followerId: varchar('follower_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followingId: varchar('following_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [primaryKey({ columns: [table.followerId, table.followingId] })]
);

export const reelViews = pgTable('reel_views', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: varchar('post_id', { length: 128 })
    .notNull()
    .references(() => posts.id, { onDelete: 'cascade' }),
  viewerUserId: varchar('viewer_user_id', { length: 128 }).references(() => users.id, {
    onDelete: 'set null'
  }),
  watchDurationMs: integer('watch_duration_ms').notNull(),
  viewerCity: varchar('viewer_city', { length: 100 }),
  viewerCountry: varchar('viewer_country', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
