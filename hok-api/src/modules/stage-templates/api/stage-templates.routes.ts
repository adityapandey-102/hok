import { Router, type Request } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody, validateQuery } from "../../../common/http/validate.middleware";
import { uuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { StageTemplatesService, type StageTemplatesCaller } from "../application/stage-templates.service";
import { DrizzleStageTemplatesRepository } from "../infrastructure/drizzle-stage-templates.repository";
import { toStageTemplateResponseDto } from "./stage-template.presenter";
import {
  createStageTemplateDtoSchema,
  stageTemplateQueryDtoSchema,
  updateStageTemplateDtoSchema,
  type CreateStageTemplateDto,
  type StageTemplateQueryDto,
  type UpdateStageTemplateDto,
} from "./dto/stage-template.dto";

/** Composition root for the Stage-templates module. */
const service = new StageTemplatesService(new DrizzleStageTemplatesRepository());

export const stageTemplatesRouter = Router();

// Reads: the Admin (all templates) and managers (active only, to pick one for
// an event); task-only staff 403. Writes: Admin only.
stageTemplatesRouter.use(requireAuth, requireCapability("events:read"));
stageTemplatesRouter.param("id", uuidParam(ERROR_CODES.STAGE_TEMPLATE_NOT_FOUND, "Stage template"));

const callerOf = (req: Request): StageTemplatesCaller => ({ userId: req.authUserId!, role: req.profile!.role });

stageTemplatesRouter.get(
  "/",
  validateQuery(stageTemplateQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const result = await service.list(callerOf(req), req.query as unknown as StageTemplateQueryDto);
    res.json({ ...result, templates: result.templates.map(toStageTemplateResponseDto) });
  }),
);

stageTemplatesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({ template: toStageTemplateResponseDto(await service.get(callerOf(req), req.params.id!)) });
  }),
);

stageTemplatesRouter.post(
  "/",
  requireCapability("stage_templates:manage"),
  validateBody(createStageTemplateDtoSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ template: toStageTemplateResponseDto(await service.create(callerOf(req), req.body as CreateStageTemplateDto)) });
  }),
);

stageTemplatesRouter.patch(
  "/:id",
  requireCapability("stage_templates:manage"),
  validateBody(updateStageTemplateDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ template: toStageTemplateResponseDto(await service.update(req.params.id!, req.body as UpdateStageTemplateDto)) });
  }),
);
