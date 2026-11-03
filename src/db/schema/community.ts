import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  uuid,
  jsonb,
  primaryKey,
  unique
} from 'drizzle-orm/pg-core';
import { users } from './identity.ts';
import { geographyPoint } from './social.ts';
import { businesses, serviceProviders } from './business.ts';

export const communities = pgTable('communities', {
  id: varchar('id', { length: 128 }).primaryKey(),
  name: varchar('name', { length: 160 }).notNull(),
  category: varchar('category', { length: 80 }).notNull(),
  description: text('description').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  originPoint: geographyPoint('origin_point').notNull(),
  radiusKm: numeric('radius_km', { precision: 6, scale: 2 }).notNull().default('40.00'),
  isPrivate: boolean('is_private').notNull().default(false),
  membersCount: integer('members_count').notNull().default(0),
  iconName: varchar('icon_name', { length: 64 }).notNull().default('Users'),
  coverGradient: varchar('cover_gradient', { length: 120 }).notNull(),
  adminUserId: varchar('admin_user_id', { length: 128 }).references(() => users.id, {
    onDelete: 'set null'
  }),
  adminName: varchar('admin_name', { length: 120 }).notNull(),
  recentPostsCount: integer('recent_posts_count').notNull().default(0),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const communityMembers = pgTable(
  'community_members',
  {
    communityId: varchar('community_id', { length: 128 })
      .notNull()
      .references(() => communities.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull().default('member'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [primaryKey({ columns: [table.communityId, table.userId] })]
);

export const events = pgTable('events', {
  id: varchar('id', { length: 128 }).primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  organizer: varchar('organizer', { length: 160 }).notNull(),
  category: varchar('category', { length: 80 }).notNull(),
  eventDate: varchar('event_date', { length: 64 }).notNull(),
  eventTime: varchar('event_time', { length: 64 }).notNull(),
  venue: varchar('venue', { length: 200 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  originPoint: geographyPoint('origin_point').notNull(),
  description: text('description').notNull(),
  registeredCount: integer('registered_count').notNull().default(0),
  isFree: boolean('is_free').notNull().default(true),
  priceInr: integer('price_inr'),
  coverGradient: varchar('cover_gradient', { length: 120 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const eventRegistrations = pgTable(
  'event_registrations',
  {
    eventId: varchar('event_id', { length: 128 })
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [primaryKey({ columns: [table.eventId, table.userId] })]
);

export const jobs = pgTable('jobs', {
  id: varchar('id', { length: 128 }).primaryKey(),
  businessId: varchar('business_id', { length: 128 }).references(() => businesses.id, {
    onDelete: 'set null'
  }),
  title: varchar('title', { length: 200 }).notNull(),
  companyName: varchar('company_name', { length: 160 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  originPoint: geographyPoint('origin_point').notNull(),
  category: varchar('category', { length: 80 }).notNull(),
  jobType: varchar('job_type', { length: 32 }).notNull(),
  salaryRange: varchar('salary_range', { length: 100 }).notNull(),
  description: text('description').notNull(),
  requirements: jsonb('requirements').$type<string[]>().notNull().default([]),
  contactPhone: varchar('contact_phone', { length: 32 }).notNull(),
  postedDate: varchar('posted_date', { length: 64 }).notNull(),
  applicantsCount: integer('applicants_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const jobApplications = pgTable(
  'job_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobId: varchar('job_id', { length: 128 })
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: 128 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    resumeS3Key: text('resume_s3_key'),
    status: varchar('status', { length: 32 }).notNull().default('submitted'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  table => [unique('uq_job_applications_job_user').on(table.jobId, table.userId)]
);

export const serviceBookings = pgTable('service_bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerId: varchar('provider_id', { length: 128 })
    .notNull()
    .references(() => serviceProviders.id, { onDelete: 'restrict' }),
  customerUserId: varchar('customer_user_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  verifiedDistanceKm: numeric('verified_distance_km', { precision: 5, scale: 2 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('requested'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
