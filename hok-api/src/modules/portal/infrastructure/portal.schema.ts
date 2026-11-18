import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * The Portal module owns `portal_links`. common/database/portal-links.ts
 * (the public token lookup, used by every /portal/:token route) and the
 * Clients module's archive (revokes the link) read/write it
 * Infrastructure-to-Infrastructure (ADR 0003).
 * Mirrors supabase/migrations/20261014400001_portal_comments.sql and 20261118000001_portal_link_token.sql.
 */
export const portalLinks = pgTable("portal_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull(),
  /** hex(sha256(token)): the public lookup goes by this. */
  tokenHash: text("token_hash").notNull(),
  /**
   * The token is stored in plain text so staff can copy the link again; decision 2026-11-18 (the user's choice).
   * Cleared when the link is revoked. Null on links made before round 5. Never returned by any public /portal route.
   */
  token: text("token"),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});
