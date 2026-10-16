import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * The Personal-events module owns `personal_events`. The Calendar module
 * reads it Infrastructure-to-Infrastructure (ADR 0003) for the merged feed.
 * Mirrors supabase/migrations/20261014300001_personal_events.sql.
 */
export const personalEvents = pgTable("personal_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull(),
  clientId: uuid("client_id"),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  timeZone: text("time_zone").notNull(),
  description: text("description"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
