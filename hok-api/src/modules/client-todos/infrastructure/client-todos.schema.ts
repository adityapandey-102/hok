import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import type { ClientTodoPriority, ClientTodoStatus } from "../domain/client-todo.entity";

/**
 * The Client to-dos module owns `client_todos`. Mirrors
 * supabase/migrations/20261017000003_client_todos.sql for typed queries only
 * (CHECKs, partial indexes, FKs and RLS live there).
 */
export const clientTodos = pgTable("client_todos", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull(),
  eventId: uuid("event_id"),
  title: text("title").notNull(),
  description: text("description"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  priority: text("priority").notNull().default("medium").$type<ClientTodoPriority>(),
  status: text("status").notNull().default("todo").$type<ClientTodoStatus>(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdBy: uuid("created_by"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
