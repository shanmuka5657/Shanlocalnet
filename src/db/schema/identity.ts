import {
  pgTable,
   pgEnum,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  uuid,
  primaryKey,
  unique
} from 'drizzle-orm/pg-core';
import { mediaAssets } from './platform.ts';

export const roleTypeEnum = pgEnum('role_type', [
  'user',
  'creator',
  'business_owner',
  'service_provider',
  'community_admin',
  'platform_admin'
]);

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
  'revoked'
]);

export const users = pgTable('users', {
  id: varchar('id', { length: 128 }).primaryKey(),
  email: varchar('email', { length: 255 }).unique(),
  phone: varchar('phone', { length: 32 }).unique(),
  activeRole: roleTypeEnum('active_role').notNull().default('user'),
  isSuspended: boolean('is_suspended').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const userProfiles = pgTable('user_profiles', {
  userId: varchar('user_id', { length: 128 })
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  handle: varchar('handle', { length: 64 }).notNull().unique(),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  avatarAssetId: uuid('avatar_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
  avatarUrl: text('avatar_url').notNull(),
  bio: text('bio').notNull().default(''),
  preferredLanguage: varchar('preferred_language', { length: 8 }).notNull().default('en'),
  homeCity: varchar('home_city', { length: 100 }).notNull().default('Kurnool'),
  homeState: varchar('home_state', { length: 100 }).notNull().default('Andhra Pradesh'),
  homeCountry: varchar('home_country', { length: 100 }).notNull().default('India'),
  homeCountryCode: varchar('home_country_code', { length: 8 }).notNull().default('IN'),
  followersCount: integer('followers_count').notNull().default(0),
  followingCount: integer('following_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const userSessions = pgTable('user_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: varchar('user_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  firebaseIat: bigint('firebase_iat', { mode: 'number' }).notNull(),
  ipHash: varchar('ip_hash', { length: 64 }).notNull(),
  userAgent: varchar('user_agent', { length: 255 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleTypeEnum('role').notNull(),
    status: approvalStatusEnum('status').notNull().default('pending'),
    approvedBy: varchar('approved_by', { length: 128 }).references(() => users.id, {
      onDelete: 'set null'
    }),
    auditReason: text('audit_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [unique('uq_user_roles_user_role').on(table.userId, table.role)]
);

export const creatorProfiles = pgTable('creator_profiles', {
  userId: varchar('user_id', { length: 128 })
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  primaryCategory: varchar('primary_category', { length: 80 }).notNull().default('Entertainment'),
  isVerifiedCreator: boolean('is_verified_creator').notNull().default(false),
  monetizationEligible: boolean('monetization_eligible').notNull().default(false),
  totalViews: bigint('total_views', { mode: 'number' }).notNull().default(0),
  totalWatchSeconds: bigint('total_watch_seconds', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const userBlocks = pgTable(
  'user_blocks',
  {
    blockerUserId: varchar('blocker_user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedUserId: varchar('blocked_user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [primaryKey({ columns: [table.blockerUserId, table.blockedUserId] })]
);
