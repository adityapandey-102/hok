import { pgTable, uuid, text, jsonb, integer, timestamp } from "drizzle-orm/pg-core";
import type { ReferenceLink, StaffTaskPriority, StaffTaskStatus, StaffTaskUpdateKind } from "../domain/staff-task.entity";

/**
 * The Staff Tasks module owns `staff_tasks` and `staff_task_updates`.
 * Mirrors supabase/migrations/20261014200001_staff_tasks.sql for typed
 * queries only (CHECKs, indexes, RLS and the event FK live there).
 */
export const staffTasks = pgTable("staff_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: uuid("assignee_id").notNull(),
  assignedBy: uuid("assigned_by"),
  clientId: uuid("client_id"),
  eventId: uuid("event_id"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  priority: text("priority").notNull().$type<StaffTaskPriority>().default("medium"),
  status: text("status").notNull().$type<StaffTaskStatus>().default("todo"),
  rawFilesUrl: text("raw_files_url"),
  referenceUrl: text("reference_url"),
  script: text("script"),
  referenceLinks: jsonb("reference_links").notNull().$type<ReferenceLink[]>().default([]),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  /** When the 2-hour due reminder went out; cleared when due_at changes or the task reopens. */
  dueRemindedAt: timestamp("due_reminded_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staffTaskUpdates = pgTable("staff_task_updates", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull(),
  authorId: uuid("author_id"),
  kind: text("kind").notNull().$type<StaffTaskUpdateKind>(),
  fromStatus: text("from_status").$type<StaffTaskStatus>(),
  toStatus: text("to_status").$type<StaffTaskStatus>(),
  fromAssigneeId: uuid("from_assignee_id"),
  toAssigneeId: uuid("to_assignee_id"),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
