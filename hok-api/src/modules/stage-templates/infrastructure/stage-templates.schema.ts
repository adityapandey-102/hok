import { pgTable, uuid, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

/**
 * The Stage-templates module owns `stage_templates` + `stage_template_stages`.
 * The Events module reads them Infrastructure-to-Infrastructure (ADR 0003)
 * when it copies a template's stages into a new event.
 * Mirrors supabase/migrations/20261013000004_stage_templates_events.sql.
 */
export const stageTemplates = pgTable("stage_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const stageTemplateStages = pgTable("stage_template_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateId: uuid("template_id").notNull(),
  position: integer("position").notNull(),
  name: text("name").notNull(),
});
