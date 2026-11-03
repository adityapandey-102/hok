import { pgTable, uuid, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import type { ApproverToken, Role } from "../../../domain";
import type { TemplateKind } from "../domain/stage-template.entity";

/**
 * The Stage-templates module owns `stage_templates` + `stage_template_stages`.
 * The Events module reads them Infrastructure-to-Infrastructure (ADR 0003)
 * when it copies a template's stages into a new event.
 * Mirrors supabase/migrations/20261013000004_stage_templates_events.sql
 * and, for kind + roles, 20261103000001_task_stages_links_client_assets.sql.
 */
export const stageTemplates = pgTable("stage_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  kind: text("kind").notNull().$type<TemplateKind>().default("event"),
  roles: text("roles").array().notNull().$type<Role[]>().default([]),
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
  /** Round 3: approver tokens (20261104000001); the API validates them (kind-dependent), the DB only the allowed set. */
  approvers: text("approvers").array().notNull().$type<ApproverToken[]>().default([]),
});
