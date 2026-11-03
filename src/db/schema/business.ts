import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  uuid,
  jsonb
} from 'drizzle-orm/pg-core';
import { users, approvalStatusEnum } from './identity.ts';
import { geographyPoint } from './social.ts';
import { mediaAssets } from './platform.ts';

export const businesses = pgTable('businesses', {
  id: varchar('id', { length: 128 }).primaryKey(),
  ownerUserId: varchar('owner_user_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  name: varchar('name', { length: 160 }).notNull(),
  category: varchar('category', { length: 80 }).notNull(),
  description: text('description').notNull(),
  phone: varchar('phone', { length: 32 }).notNull(),
  coverGradient: varchar('cover_gradient', { length: 120 }),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  openingHours: varchar('opening_hours', { length: 120 }).notNull(),
  isVerified: boolean('is_verified').notNull().default(false),
  verificationStatus: approvalStatusEnum('verification_status').notNull().default('pending'),
  verifiedByAdminId: varchar('verified_by_admin_id', { length: 128 }).references(() => users.id, {
    onDelete: 'set null'
  }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('0.00'),
  reviewCount: integer('review_count').notNull().default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const businessLocations = pgTable('business_locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: varchar('business_id', { length: 128 })
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  isPrimary: boolean('is_primary').notNull().default(true),
  addressLine: text('address_line').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }).notNull(),
  country: varchar('country', { length: 100 }).notNull().default('India'),
  countryCode: varchar('country_code', { length: 8 }).notNull().default('IN'),
  physicalPoint: geographyPoint('physical_point').notNull(),
  maxServiceRadiusKm: numeric('max_service_radius_km', { precision: 5, scale: 2 })
    .notNull()
    .default('15.00'),
  locationVerified: boolean('location_verified').notNull().default(false),
  verificationStatus: approvalStatusEnum('verification_status').notNull().default('pending'),
  verifiedByAdminId: varchar('verified_by_admin_id', { length: 128 }).references(() => users.id, {
    onDelete: 'set null'
  }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const businessVerifications = pgTable('business_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  businessId: varchar('business_id', { length: 128 })
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  businessLocationId: uuid('business_location_id')
    .notNull()
    .references(() => businessLocations.id, { onDelete: 'cascade' }),
  submittedByUserId: varchar('submitted_by_user_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  documentType: varchar('document_type', { length: 64 }).notNull(),
  documentMediaAssetId: uuid('document_media_asset_id').references(() => mediaAssets.id, {
    onDelete: 'set null'
  }),
  documentS3Key: text('document_s3_key').notNull(),
  submittedPoint: geographyPoint('submitted_point').notNull(),
  status: approvalStatusEnum('status').notNull().default('pending'),
  reviewedByAdminId: varchar('reviewed_by_admin_id', { length: 128 }).references(() => users.id, {
    onDelete: 'set null'
  }),
  reviewNotes: text('review_notes'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const serviceProviders = pgTable('service_providers', {
  id: varchar('id', { length: 128 }).primaryKey(),
  userId: varchar('user_id', { length: 128 }).references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 160 }).notNull(),
  serviceCategory: varchar('service_category', { length: 80 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  originPoint: geographyPoint('origin_point').notNull(),
  serviceRadiusKm: numeric('service_radius_km', { precision: 5, scale: 2 }).notNull(),
  rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('4.50'),
  reviewCount: integer('review_count').notNull().default(0),
  phone: varchar('phone', { length: 32 }).notNull(),
  experienceYears: integer('experience_years').notNull().default(1),
  hourlyRate: varchar('hourly_rate', { length: 64 }),
  description: text('description').notNull(),
  verified: boolean('verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
