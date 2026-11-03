import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import type { ApprovalStatus } from "../../../domain";

/**
 * The Approvals module owns `stage_approvals`. Mirrors supabase/migrations/20261104000001_stage_approvals.sql
 * for typed queries only (the one-subject CHECK, the one-pending partial unique indexes, the other CHECKs,
 * indexes and RLS live there). A row is one round of asking for approval on ONE stage of ONE item: an event
 * (event_id + event_stage_id) or a staff task (task_id + task_stage_id).
 */
export const stageApprovals = pgTable("stage_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id"),
  taskId: uuid("task_id"),
  eventStageId: uuid("event_stage_id"),
  taskStageId: uuid("task_stage_id"),
  status: text("status").notNull().$type<ApprovalStatus>().default("pending"),
  requestNote: text("request_note"),
  requestLink: text("request_link"),
  requestedBy: uuid("requested_by"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  /** Null when decided by the client in the portal, or when a move cancelled/superseded the row. */
  decidedBy: uuid("decided_by"),
  decidedVia: text("decided_via").$type<"staff" | "portal">(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionComment: text("decision_comment"),
  version: integer("version").notNull().default(1),
});
