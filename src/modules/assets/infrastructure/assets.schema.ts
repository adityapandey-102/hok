import { pgTable, uuid, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import type { AssetType } from "../domain/asset.entity";

/**
 * The Assets module owns `assets`, `tags` and `asset_tags`. Mirrors
 * supabase/migrations/20261014100001_assets.sql for typed queries only (CHECKs,
 * partial/trigram indexes, FKs and RLS live there).
 */
export const assets = pgTable("assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull(),
  eventId: uuid("event_id"),
  title: text("title").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull().$type<AssetType>(),
  comment: text("comment"),
  version: integer("version").notNull().default(1),
  createdBy: uuid("created_by"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assetTags = pgTable(
  "asset_tags",
  {
    assetId: uuid("asset_id").notNull(),
    tagId: uuid("tag_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.tagId] })],
);
