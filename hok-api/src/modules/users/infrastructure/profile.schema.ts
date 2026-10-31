import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import type { Role } from "../../../domain";

/**
 * The Users module owns `profiles` -- every other module that needs a
 * profile row reads it via an Infrastructure-to-Infrastructure import of this
 * file, never through Users' Application/Domain layers. See
 * docs/adr/0003-per-module-schema-ownership.md.
 *
 * Deliberately does NOT include auth.users (Supabase Auth's own schema) or
 * RLS/the handle_new_user() trigger -- those stay in supabase/migrations/*.sql,
 * genuinely vendor-specific glue. The DDL itself is
 * supabase/migrations/20261013000001_profiles.sql; this file only mirrors it
 * for typed queries (role is CHECK-constrained in the database and typed via
 * $type<Role>() here), so it introduces zero DDL drift.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().$type<Role>(),
  timeZone: text("time_zone").notNull(),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  active: boolean("active").notNull().default(true),
  /** The first Admin (supabase/migrations/20261030000003); at most one row, enforced by a unique partial index. */
  isOwner: boolean("is_owner").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  /** Last authenticated API call, throttled (FR-SYS-03). */
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  /** SHA-256 of the person's calendar subscribe token (FR-CAL-08); null = no link. The Calendar module manages it. */
  calendarFeedTokenHash: text("calendar_feed_token_hash"),
  calendarFeedCreatedAt: timestamp("calendar_feed_created_at", { withTimezone: true }),
});
