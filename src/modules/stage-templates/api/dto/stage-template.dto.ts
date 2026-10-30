import { z } from "zod";
import { STAGES_MAX, STAGE_NAME_MAX_LENGTH, TEMPLATE_NAME_MAX_LENGTH } from "../../domain/stage-template.entity";

const name = z.string().trim().min(1, "Please enter a template name").max(TEMPLATE_NAME_MAX_LENGTH);
/** The whole ordered list. Blank/duplicate names are refused by the domain rule (normalizeStageNames). */
const stages = z
  .array(z.string().max(STAGE_NAME_MAX_LENGTH, `Each stage name is at most ${STAGE_NAME_MAX_LENGTH} characters`))
  .min(1, "A template needs at least one stage")
  .max(STAGES_MAX, `At most ${STAGES_MAX} stages`);

/** POST /stage-templates (Admin). New templates are active. */
export const createStageTemplateDtoSchema = z.object({ name, stages });
export type CreateStageTemplateDto = z.infer<typeof createStageTemplateDtoSchema>;

/**
 * PATCH /stage-templates/:id (Admin). `stages` replaces the whole ordered list
 * (rename / reorder / add / remove); `active: false` deactivates. `version`
 * required. Events already created keep their own copy of the stages.
 */
export const updateStageTemplateDtoSchema = z.object({
  name: name.optional(),
  stages: stages.optional(),
  active: z.boolean().optional(),
  version: z.number().int().min(1),
});
export type UpdateStageTemplateDto = z.infer<typeof updateStageTemplateDtoSchema>;

export const TEMPLATES_DEFAULT_LIMIT = 50;
export const TEMPLATES_MAX_LIMIT = 100;

/**
 * GET /stage-templates. `active` filters for the Admin; anyone else (a manager
 * picking a template for a new event) only ever sees active ones.
 */
export const stageTemplateQueryDtoSchema = z.object({
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
