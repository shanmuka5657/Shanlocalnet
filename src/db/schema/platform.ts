import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  uuid,
  jsonb,
  pgEnum
} from 'drizzle-orm/pg-core';
import { users } from './identity.ts';

export const bucketCategoryEnum = pgEnum('bucket_category_enum', [
  'avatars',
  'posts_images',
  'videos_original',
  'videos_processed',
  'business_media',
  'temp_uploads'
]);

export const mediaProcessingStatusEnum = pgEnum('media_processing_status_enum', [
  'pending',
  'processing',
  'ready',
  'failed'
]);

export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: varchar('owner_user_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  bucketCategory: varchar('bucket_category', { length: 32 }).notNull(),
  s3Key: text('s3_key').notNull().unique(),
  cloudfrontUrl: text('cloudfront_url'),
  mimeType: varchar('mime_type', { length: 64 }).notNull(),
  magicBytesVerified: boolean('magic_bytes_verified').notNull().default(false),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  durationSeconds: integer('duration_seconds'),
  width: integer('width'),
  height: integer('height'),
  processingStatus: varchar('processing_status', { length: 32 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const outboxStatusEnum = pgEnum('outbox_status_enum', [
  'pending',
  'processing',
  'completed',
  'failed',
  'dead_letter'
]);

export const outboxEvents = pgTable('outbox_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull().unique(),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  workerId: varchar('worker_id', { length: 128 }),
  leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(5),
  lastError: text('last_error'),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: varchar('key', { length: 128 }).primaryKey(),
  userId: varchar('user_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  endpoint: varchar('endpoint', { length: 128 }).notNull(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  responseStatus: integer('response_status').notNull(),
  responseBody: jsonb('response_body').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const moderationReports = pgTable('moderation_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterUserId: varchar('reporter_user_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  targetType: varchar('target_type', { length: 32 }).notNull(),
  targetId: varchar('target_id', { length: 128 }).notNull(),
  reason: varchar('reason', { length: 120 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: varchar('actor_user_id', { length: 128 }).references(() => users.id, {
    onDelete: 'set null'
  }),
  actorRole: varchar('actor_role', { length: 32 }),
  action: varchar('action', { length: 120 }).notNull(),
  targetType: varchar('target_type', { length: 64 }).notNull(),
  targetId: varchar('target_id', { length: 128 }).notNull(),
  ticketReference: varchar('ticket_reference', { length: 128 }),
  metadata: jsonb('metadata').notNull().default({}),
  ipHash: varchar('ip_hash', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const privilegedOriginCorrectionTokens = pgTable('_privileged_origin_correction_tokens', {
  txid: bigint('txid', { mode: 'number' }).primaryKey(),
  targetTable: varchar('target_table', { length: 32 }).notNull(),
  targetId: varchar('target_id', { length: 128 }).notNull(),
  adminUserId: varchar('admin_user_id', { length: 128 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

