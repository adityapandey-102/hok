import { Router } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { DashboardService } from "../application/dashboard.service";
import { DrizzleDashboardRepository } from "../infrastructure/drizzle-dashboard.repository";

/** Composition root for the Dashboard module (read-only; owns no table). */
const service = new DashboardService(new DrizzleDashboardRepository());

export const dashboardRouter = Router();

// Every staff role has a dashboard; what it holds is decided by role in the
// service (own tasks for all, own clients for managers, the firm for Admin).
dashboardRouter.use(requireAuth);

/** FR-DSH-01..03: the caller's dashboard. Already the wire shape (no presenter). */
dashboardRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const p = req.profile!;
    res.json(await service.get({ userId: p.id, role: p.role, timeZone: p.timeZone }));
  }),
);
