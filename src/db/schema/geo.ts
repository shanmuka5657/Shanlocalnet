import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  doublePrecision,
  numeric,
  timestamp,
  uuid,
  jsonb
} from 'drizzle-orm/pg-core';
import { users } from './identity.ts';
import { posts, geographyPoint } from './social.ts';
import { campaigns } from './ads.ts';
import { marketplaceListings } from './marketplace.ts';

export const locationVerifications = pgTable('location_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: varchar('user_id', { length: 128 }).references(() => users.id, { onDelete: 'cascade' }),
  sessionToken: varchar('session_token', { length: 128 }).notNull().unique(),
  verifiedPoint: geographyPoint('verified_point').notNull(),
  accuracyMeters: doublePrecision('accuracy_meters').notNull(),
  resolvedCity: varchar('resolved_city', { length: 100 }).notNull(),
  resolvedState: varchar('resolved_state', { length: 100 }).notNull(),
  resolvedCountry: varchar('resolved_country', { length: 100 }).notNull(),
  resolvedCountryCode: varchar('resolved_country_code', { length: 8 }).notNull(),
  verificationSource: varchar('verification_source', { length: 32 }).notNull(),
  spoofingRiskScore: integer('spoofing_risk_score').notNull().default(0),
  verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
});

/**
 * §4.2 & §4.4: Explicit nullable foreign keys with an Exclusive Arc CHECK constraint
 * in PostgreSQL (num_nonnulls(post_id, campaign_id, listing_id) = 1).
 */
export const contentClassifications = pgTable('content_classifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: varchar('post_id', { length: 128 }).references(() => posts.id, { onDelete: 'cascade' }),
  campaignId: varchar('campaign_id', { length: 128 }).references(() => campaigns.id, {
    onDelete: 'cascade'
  }),
  listingId: varchar('listing_id', { length: 128 }).references(() => marketplaceListings.id, {
    onDelete: 'cascade'
  }),
  submittedClassification: varchar('submitted_classification', { length: 32 }).notNull(),
  enforcedClassification: varchar('enforced_classification', { length: 32 }).notNull(),
  enforcedEngine: varchar('enforced_engine', { length: 32 }).notNull(),
  enforcementReason: text('enforcement_reason').notNull(),
  detectedKeywords: jsonb('detected_keywords').$type<string[]>().notNull().default([]),
  reclassifiedFromOrganic: boolean('reclassified_from_organic').notNull().default(false),
  classifierVersion: varchar('classifier_version', { length: 32 })
    .notNull()
    .default('v2.1-stage-b1'),
  reviewerUserId: varchar('reviewer_user_id', { length: 128 }).references(() => users.id, {
    onDelete: 'set null'
  }),
  reviewerDecision: varchar('reviewer_decision', { length: 32 }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const geoAuditLogs = pgTable('geo_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: varchar('item_id', { length: 128 }).notNull(),
  itemType: varchar('item_type', { length: 32 }).notNull(),
  engine: varchar('engine', { length: 32 }).notNull(),
  originCity: varchar('origin_city', { length: 100 }).notNull(),
  viewerCity: varchar('viewer_city', { length: 100 }).notNull(),
  distanceKm: numeric('distance_km', { precision: 8, scale: 2 }).notNull(),
  selectedScope: varchar('selected_scope', { length: 32 }).notNull(),
  isDelivered: boolean('is_delivered').notNull(),
  ruleCode: varchar('rule_code', { length: 64 }).notNull(),
  notes: text('notes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
