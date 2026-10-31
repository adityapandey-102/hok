import { Router } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { validateQuery } from "../../../common/http/validate.middleware";
import { teamWorkloadQueryDtoSchema, type TeamWorkloadQueryDto } from "./dto/team-workload-query.dto";
import { dashboardQueryDtoSchema, type DashboardQueryDto } from "./dto/dashboard-query.dto";
import { DashboardService } from "../application/dashboard.service";
import { DrizzleDashboardRepository } from "../infrastructure/drizzle-dashboard.repository";

/** Composition root for the Dashboard module (read-only; owns no table). */
const service = new DashboardService(new DrizzleDashboardRepository());

export const dashboardRouter = Router();

// Every staff role has a dashboard; what it holds is decided by role in the
// service (own tasks for all, own clients for managers, the firm for Admin).
dashboardRouter.use(requireAuth);

/** FR-DSH-01..03: the caller's dashboard (`?view=overview|mine`). Already the wire shape (no presenter). */
dashboardRouter.get(
  "/",
  validateQuery(dashboardQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const p = req.profile!;
    const { view } = req.query as unknown as DashboardQueryDto;
    res.json(await service.get({ userId: p.id, role: p.role, timeZone: p.timeZone }, view));
  }),
);

/** FR-DSH-01 "team workload" in full (Admin): every active non-admin, busiest first; name search, role, paged. */
dashboardRouter.get(
  "/team",
  requireCapability("dashboard:global"),
  validateQuery(teamWorkloadQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as TeamWorkloadQueryDto;
    res.json(await service.teamPage({ search: q.search, role: q.role }, q.limit, q.offset));
  }),
);
