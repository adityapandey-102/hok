import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import type { EventState, EventType } from "../domain/event.entity";

/**
 * The Events module owns `events`, `event_stages`, `event_stage_history`.
 * Mirrors supabase/migrations/20261013000004_stage_templates_events.sql for
 * typed queries only (the composite current-stage FK, CHECKs, indexes and
 * RLS live there).
 */
export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull().$type<EventType>(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  timeZone: text("time_zone").notNull(),
  location: text("location"),
  description: text("description"),
  assignedTeam: uuid("assigned_team").array().notNull().default([]),
  templateId: uuid("template_id"),
  templateName: text("template_name").notNull(),
  currentStageId: uuid("current_stage_id"),
  stageCount: integer("stage_count").notNull(),
  state: text("state").notNull().$type<EventState>().default("active"),
  version: integer("version").notNull().default(1),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventStages = pgTable("event_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull(),
  position: integer("position").notNull(),
  name: text("name").notNull(),
});

export const eventStageHistory = pgTable("event_stage_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull(),
  fromStageId: uuid("from_stage_id"),
  toStageId: uuid("to_stage_id").notNull(),
  note: text("note"),
  visibleToClient: boolean("visible_to_client").notNull().default(false),
  changedBy: uuid("changed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
