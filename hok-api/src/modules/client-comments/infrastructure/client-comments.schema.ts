import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import type { CommentStatus } from "../domain/client-comment.entity";

/**
 * The Client-comments module owns `client_comments` and
 * `client_comment_history`. DDL: supabase/migrations/20261014400001_portal_comments.sql
 * (shared with the Portal module's `portal_links`); this file only mirrors it.
 */
export const clientComments = pgTable("client_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull(),
  eventId: uuid("event_id"),
  portalLinkId: uuid("portal_link_id"),
  body: text("body").notNull(),
  status: text("status").notNull().$type<CommentStatus>().default("received"),
  reply: text("reply"),
  repliedBy: uuid("replied_by"),
  repliedAt: timestamp("replied_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Append-only status history (who moved it, when). */
export const clientCommentHistory = pgTable("client_comment_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  commentId: uuid("comment_id").notNull(),
  fromStatus: text("from_status").notNull().$type<CommentStatus>(),
  toStatus: text("to_status").notNull().$type<CommentStatus>(),
  changedBy: uuid("changed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
