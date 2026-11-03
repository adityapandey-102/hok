import { z } from "zod";
import { ROLES } from "../../../../domain";
import { STAGES_MAX, STAGE_NAME_MAX_LENGTH, TEMPLATE_KINDS, TEMPLATE_NAME_MAX_LENGTH } from "../../domain/stage-template.entity";

const name = z.string().trim().min(1, "Please enter a template name").max(TEMPLATE_NAME_MAX_LENGTH);
/** The whole ordered list. Blank/duplicate names are refused by the domain rule (normalizeStageNames). */
const stages = z
  .array(z.string().max(STAGE_NAME_MAX_LENGTH, `Each stage name is at most ${STAGE_NAME_MAX_LENGTH} characters`))
  .min(1, "A template needs at least one stage")
  .max(STAGES_MAX, `At most ${STAGES_MAX} stages`);

/** Known roles only here; "admin" and roles on an event template are refused by the domain rule (STAGE_TEMPLATE_ROLES_INVALID). */
const roles = z.array(z.enum(ROLES)).max(ROLES.length);

/**
 * POST /stage-templates (Admin). New templates are active. `kind` defaults to
 * "event"; `roles` (task templates only) = the assignee roles it is offered for,
 * empty = any role.
 */
export const createStageTemplateDtoSchema = z.object({
  name,
  stages,
  kind: z.enum(TEMPLATE_KINDS).optional().default("event"),
  roles: roles.optional(),
});
export type CreateStageTemplateDto = z.infer<typeof createStageTemplateDtoSchema>;

/**
 * PATCH /stage-templates/:id (Admin). `stages` replaces the whole ordered list
 * (rename / reorder / add / remove); `active: false` deactivates. `version`
 * required. Events already created keep their own copy of the stages. `roles`
 * replaces the role list of a task template. The `kind` never changes, so the
 * schema is strict: sending one is a 400 VALIDATION_ERROR.
 */
export const updateStageTemplateDtoSchema = z
  .object({
    name: name.optional(),
    stages: stages.optional(),
    active: z.boolean().optional(),
    roles: roles.optional(),
    version: z.number().int().min(1),
  })
  .strict();
export type UpdateStageTemplateDto = z.infer<typeof updateStageTemplateDtoSchema>;

export const TEMPLATES_DEFAULT_LIMIT = 50;
export const TEMPLATES_MAX_LIMIT = 100;

/**
 * GET /stage-templates. `active` filters for the Admin; anyone else (a manager
 * picking a template for a new event or task) only ever sees active ones.
 * `kind` narrows to event or task templates; `role` (implies task templates)
 * keeps those offered for that assignee role -- an empty role list counts as any.
 */
export const stageTemplateQueryDtoSchema = z.object({
  kind: z.enum(TEMPLATE_KINDS).optional(),
  role: z.enum(ROLES).optional(),
  search: z
    .string()
    .trim()
    .max(80)
    
    .transform((v) => (v ? v : undefined)).optional(),
  active: z.enum(["true", "false"]).optional().transform((v) => (v === undefined ? undefined : v === "true")),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .transform((v) => Math.min(Math.max(v ?? TEMPLATES_DEFAULT_LIMIT, 1), TEMPLATES_MAX_LIMIT)),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type StageTemplateQueryDto = z.infer<typeof stageTemplateQueryDtoSchema>;
