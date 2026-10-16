import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

/** What `notifications.payload` holds (normalised by the domain rules before it's written). */
export interface StoredNotificationPayload {
  title: string;
  body: string | null;
  url: string | null;
  data: Record<string, string>;
}

/**
 * The Notifications module owns `notifications`, `push_subscriptions` and
 * `notification_preferences`. Mirrors
 * supabase/migrations/20261014500001_notifications.sql for typed queries only
 * (CHECKs, partial indexes, FKs and RLS live there).
 */
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  type: text("type").notNull(),
  actorId: uuid("actor_id"),
  payload: jsonb("payload").notNull().$type<StoredNotificationPayload>(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id").primaryKey(),
  mutedPush: text("muted_push").array().notNull().default([]),
  mutedInApp: text("muted_in_app").array().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
