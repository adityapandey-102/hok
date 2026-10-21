import { Router } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { validateQuery } from "../../../common/http/validate.middleware";
import { activityQueryDtoSchema, type ActivityQueryDto } from "./dto/activity-query.dto";
import { ActivityService } from "../application/activity.service";
import { DrizzleActivityRepository } from "../infrastructure/drizzle-activity.repository";

/** Composition root for the Activity module (read-only; owns no table). */
const service = new ActivityService(new DrizzleActivityRepository());

export const activityRouter = Router();

activityRouter.use(requireAuth);

/** FR-SYS-02 / FR-RPT-05 (Admin only): who did what, newest first. Already the wire shape (no presenter). */
activityRouter.get(
  "/",
  requireCapability("dashboard:global"),
  validateQuery(activityQueryDtoSchema),
  asyncHandler(async (req, res) => {
    res.json(await service.list(req.query as unknown as ActivityQueryDto));
  }),
);
