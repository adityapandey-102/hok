import { Router } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { validateQuery } from "../../../common/http/validate.middleware";
import {
  clientReportQueryDtoSchema,
  staffReportQueryDtoSchema,
  teamStatusQueryDtoSchema,
  type ClientReportQueryDto,
  type StaffReportQueryDto,
  type TeamStatusQueryDto,
} from "./dto/report-query.dto";
import { ReportsService } from "../application/reports.service";
import { DrizzleReportRepository } from "../infrastructure/drizzle-report.repository";

/** Composition root for the Reports module (read-only; owns no table). */
const service = new ReportsService(new DrizzleReportRepository());

export const reportsRouter = Router();

// FR-RPT-01: every report is Admin only.
reportsRouter.use(requireAuth);
reportsRouter.use(requireCapability("dashboard:global"));

/** FR-RPT-02: who is working or idle right now. Already the wire shape (no presenter). */
reportsRouter.get(
  "/team-status",
  validateQuery(teamStatusQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as TeamStatusQueryDto;
    res.json(await service.teamStatusPage({ search: q.search, role: q.role, status: q.status }, q.limit, q.offset));
  }),
);

/** FR-RPT-03: one person, one month (the viewer's zone). */
reportsRouter.get(
  "/staff",
  validateQuery(staffReportQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as StaffReportQueryDto;
    res.json(await service.staffReport(q.userId, q.month, req.profile!.timeZone));
  }),
);

/** FR-RPT-04: one client, one month (the viewer's zone). */
reportsRouter.get(
  "/client",
  validateQuery(clientReportQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as ClientReportQueryDto;
    res.json(await service.clientReport(q.clientId, q.month, req.profile!.timeZone));
  }),
);
