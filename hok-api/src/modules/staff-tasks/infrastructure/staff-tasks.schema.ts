import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import type { StaffTaskPriority, StaffTaskStatus, StaffTaskUpdateKind, TaskLinkKind } from "../domain/staff-task.entity";

/**
 * The Staff Tasks module owns `staff_tasks`, `task_stages`, `staff_task_links`
 * and `staff_task_updates`. Mirrors supabase/migrations/20261014200001_staff_tasks.sql
 * and 20261103000001_task_stages_links_client_assets.sql for typed queries only
 * (CHECKs, indexes, RLS and the event FK live there).
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
  // shortcut: raw_files_url, reference_url and reference_links are unused since round 2 (their data became
  // brief links); drop the columns in a later cleanup migration. They are no longer mapped here.
  /** The brief (instructions, a script...), stored in the original `script` column. */
  script: text("script"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  /** When the 2-hour due reminder went out; cleared when due_at changes or the task reopens. */
  dueRemindedAt: timestamp("due_reminded_at", { withTimezone: true }),
  /** The task template it started from (null if that is ever deleted) and its name at the time. */
  templateId: uuid("template_id"),
  templateName: text("template_name").notNull().default("Simple (older task)"),
  /** Always one of this task's stages (composite FK). Null only between inserting the task and its stages. */
  currentStageId: uuid("current_stage_id"),
  stageCount: integer("stage_count").notNull().default(3),
  blockedReason: text("blocked_reason"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A task's stages, snapshotted from its template at creation; never edited afterwards. */
export const taskStages = pgTable("task_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull(),
  position: integer("position").notNull(),
  name: text("name").notNull(),
});

export const staffTaskLinks = pgTable("staff_task_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull(),
  kind: text("kind").notNull().$type<TaskLinkKind>(),
  url: text("url").notNull(),
  label: text("label"),
  stageId: uuid("stage_id"),
  addedBy: uuid("added_by"),
  sharedAssetId: uuid("shared_asset_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
  fromStageId: uuid("from_stage_id"),
  toStageId: uuid("to_stage_id"),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
