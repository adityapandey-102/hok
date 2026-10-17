import { z } from "zod";
import { DASHBOARD_VIEWS } from "../../domain/dashboard.entity";

/** GET /dashboard: `view` overview (default) or mine. Parsed strictly: anything else is a 400. */
export const dashboardQueryDtoSchema = z.object({
  view: z.enum(DASHBOARD_VIEWS).optional().default("overview"),
});
export type DashboardQueryDto = z.infer<typeof dashboardQueryDtoSchema>;
