import {
  pgTable,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  numeric,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';
import { users } from './identity.ts';
import { geographyPoint } from './social.ts';
import { businesses } from './business.ts';

export const marketplaceListings = pgTable('marketplace_listings', {
  id: varchar('id', { length: 128 }).primaryKey(),
  businessId: varchar('business_id', { length: 128 }).references(() => businesses.id, {
    onDelete: 'set null'
  }),
  sellerUserId: varchar('seller_user_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  sellerName: varchar('seller_name', { length: 160 }).notNull(),
  sellerVerified: boolean('seller_verified').notNull().default(false),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 80 }).notNull(),
  pricePaise: bigint('price_paise', { mode: 'number' }).notNull(),
  currency: varchar('currency', { length: 8 }).notNull().default('INR'),
  originPoint: geographyPoint('origin_point').notNull(),
  cityName: varchar('city_name', { length: 100 }).notNull(),
  maxDeliveryRadiusKm: numeric('max_delivery_radius_km', { precision: 5, scale: 2 }).notNull(),
  coverGradient: varchar('cover_gradient', { length: 120 }),
  imageUrl: text('image_url'),
  condition: varchar('condition', { length: 32 }).notNull().default('new'),
  contactPhone: varchar('contact_phone', { length: 32 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const inventory = pgTable('inventory', {
  listingId: varchar('listing_id', { length: 128 })
    .primaryKey()
    .references(() => marketplaceListings.id, { onDelete: 'cascade' }),
  availableQty: integer('available_qty').notNull().default(10),
  reservedQty: integer('reserved_qty').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const orders = pgTable('orders', {
  id: varchar('id', { length: 128 }).primaryKey(),
  buyerUserId: varchar('buyer_user_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull().unique(),
  totalAmountPaise: bigint('total_amount_paise', { mode: 'number' }).notNull(),
  deliveryCity: varchar('delivery_city', { length: 100 }).notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  customerName: varchar('customer_name', { length: 160 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 32 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('pending_payment'),
  inventoryRestored: boolean('inventory_restored').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: varchar('order_id', { length: 128 })
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  listingId: varchar('listing_id', { length: 128 })
    .notNull()
    .references(() => marketplaceListings.id, { onDelete: 'restrict' }),
  quantity: integer('quantity').notNull(),
  unitPricePaise: bigint('unit_price_paise', { mode: 'number' }).notNull(),
  verifiedDistanceKm: numeric('verified_distance_km', { precision: 5, scale: 2 }).notNull()
});

export const paymentTransactions = pgTable('payment_transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: varchar('order_id', { length: 128 })
    .notNull()
    .references(() => orders.id, { onDelete: 'restrict' }),
  provider: varchar('provider', { length: 32 }).notNull(),
  providerWebhookEventId: varchar('provider_webhook_event_id', { length: 128 }).notNull().unique(),
  providerPaymentRef: varchar('provider_payment_ref', { length: 128 }).notNull(),
  amountPaise: bigint('amount_paise', { mode: 'number' }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const sellerConversations = pgTable('seller_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: varchar('listing_id', { length: 128 })
    .notNull()
    .references(() => marketplaceListings.id, { onDelete: 'cascade' }),
  buyerUserId: varchar('buyer_user_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sellerUserId: varchar('seller_user_id', { length: 128 })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  lastMessageText: text('last_message_text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const flashDeals = pgTable('flash_deals', {
  id: uuid('id').defaultRandom().primaryKey(),
  listingId: varchar('listing_id', { length: 128 })
    .notNull()
    .references(() => marketplaceListings.id, { onDelete: 'cascade' }),
  discountPercent: integer('discount_percent').notNull(),
  maxRadiusKm: numeric('max_radius_km', { precision: 5, scale: 2 }).notNull().default('15.00'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull()
});
