import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import type { TodoUrgency } from "../domain/todo.entity";

/**
 * The To-dos module owns `todos` (private, per person). The Calendar,
 * Dashboard and Reminders modules read it Infrastructure-to-Infrastructure
 * (ADR 0003). Mirrors supabase/migrations/20261102000001_todos.sql for typed
 * queries only (CHECKs, partial indexes and RLS live there).
 */
export const todos = pgTable("todos", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").notNull(),
  title: text("title").notNull(),
  notes: text("notes"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  urgency: text("urgency").notNull().default("medium").$type<TodoUrgency>(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  nextRemindAt: timestamp("next_remind_at", { withTimezone: true }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
