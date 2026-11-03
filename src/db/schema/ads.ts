import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  numeric,
  date,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';
import { users, approvalStatusEnum } from './identity.ts';
import { geographyPoint } from './social.ts';
import { businesses, businessLocations } from './business.ts';
import { mediaAssets } from './platform.ts';

export const campaigns = pgTable('campaigns', {
  id: varchar('id', { length: 128 }).primaryKey(),
  businessId: varchar('business_id', { length: 128 })
    .notNull()
    .references(() => businesses.id, { onDelete: 'restrict' }),
  businessLocationId: uuid('business_location_id')
    .notNull()
    .references(() => businessLocations.id, { onDelete: 'restrict' }),
  campaignName: varchar('campaign_name', { length: 160 }).notNull(),
  headline: varchar('headline', { length: 255 }).notNull(),
  bodyText: text('body_text').notNull(),
  callToAction: varchar('call_to_action', { length: 32 }).notNull(),
  ctaUrl: text('cta_url').notNull(),

  originPoint: geographyPoint('origin_point').notNull(),
  targetCity: varchar('target_city', { length: 100 }).notNull(),
  originVerified: boolean('origin_verified').notNull().default(false),

  selectedRadiusKm: numeric('selected_radius_km', { precision: 5, scale: 2 }).notNull(),
  selectedRadiusMeters: integer('selected_radius_meters'),

  budgetTotalPaise: bigint('budget_total_paise', { mode: 'number' }).notNull(),
  budgetSpentPaise: bigint('budget_spent_paise', { mode: 'number' }).notNull().default(0),
  currency: varchar('currency', { length: 8 }).notNull().default('INR'),
  billingModel: varchar('billing_model', { length: 8 }).notNull(),
  costPerUnitPaise: bigint('cost_per_unit_paise', { mode: 'number' }).notNull(),

  maxImpressionsPerUserDay: integer('max_impressions_per_user_day').notNull().default(3),
  approvalStatus: approvalStatusEnum('approval_status').notNull().default('pending'),
  approvedByAdminId: varchar('approved_by_admin_id', { length: 128 }).references(() => users.id, {
    onDelete: 'set null'
  }),
  rejectionReason: text('rejection_reason'),
  isActive: boolean('is_active').notNull().default(false),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),

  impressionsCount: integer('impressions_count').notNull().default(0),
  clicksCount: integer('clicks_count').notNull().default(0),
  conversionsCount: integer('conversions_count').notNull().default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const campaignCreatives = pgTable('campaign_creatives', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: varchar('campaign_id', { length: 128 })
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  creativeType: varchar('creative_type', { length: 16 }).notNull(),
  mediaAssetId: uuid('media_asset_id').references(() => mediaAssets.id, { onDelete: 'set null' }),
  creativeUrl: text('creative_url'),
  creativeGradient: varchar('creative_gradient', { length: 120 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const adImpressions = pgTable('ad_impressions', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: varchar('campaign_id', { length: 128 })
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  viewerUserId: varchar('viewer_user_id', { length: 128 }).references(() => users.id, {
    onDelete: 'set null'
  }),
  viewerSessionId: varchar('viewer_session_id', { length: 128 }).notNull(),
  idempotencyToken: varchar('idempotency_token', { length: 128 }).notNull().unique(),
  impressionDate: date('impression_date').notNull().defaultNow(),
  viewerDistanceKm: numeric('viewer_distance_km', { precision: 6, scale: 2 }).notNull(),
  chargedPaise: bigint('charged_paise', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const adClicks = pgTable('ad_clicks', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: varchar('campaign_id', { length: 128 })
    .notNull()
    .references(() => campaigns.id, { onDelete: 'cascade' }),
  impressionId: uuid('impression_id').references(() => adImpressions.id, { onDelete: 'set null' }),
  viewerUserId: varchar('viewer_user_id', { length: 128 }).references(() => users.id, {
    onDelete: 'set null'
  }),
  viewerSessionId: varchar('viewer_session_id', { length: 128 }).notNull(),
  idempotencyToken: varchar('idempotency_token', { length: 128 }).notNull().unique(),
  viewerDistanceKm: numeric('viewer_distance_km', { precision: 6, scale: 2 }).notNull(),
  chargedPaise: bigint('charged_paise', { mode: 'number' }).notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const campaignSpendRecords = pgTable('campaign_spend_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: varchar('campaign_id', { length: 128 })
    .notNull()
    .references(() => campaigns.id, { onDelete: 'restrict' }),
  eventType: varchar('event_type', { length: 16 }).notNull(),
  referenceEventId: uuid('reference_event_id').notNull().unique(),
  amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
  balanceAfterPaise: bigint('balance_after_paise', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
