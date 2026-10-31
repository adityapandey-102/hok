import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * The Portal module owns `portal_links`. common/database/portal-links.ts
 * (the public token lookup, used by every /portal/:token route) and the
 * Clients module's archive (revokes the link) read/write it
 * Infrastructure-to-Infrastructure (ADR 0003).
 * Mirrors supabase/migrations/20261014400001_portal_comments.sql.
 */
export const portalLinks = pgTable("portal_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull(),
  /** hex(sha256(token)) -- the token itself is never stored. */
  tokenHash: text("token_hash").notNull(),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});
