import { z } from "zod";
import { ROLES } from "../../../../domain";
import { TEAM_STATUSES, TEAM_STATUS_PAGE_DEFAULT, TEAM_STATUS_PAGE_MAX } from "../../domain/report.entity";

const nonAdminRoles = ROLES.filter((r) => r !== "admin") as [Exclude<(typeof ROLES)[number], "admin">, ...Exclude<(typeof ROLES)[number], "admin">[]];

/** GET /reports/team-status: name search, role, working|idle, paged (<= 50). Parsed strictly. */
export const teamStatusQueryDtoSchema = z.object({
  search: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v : undefined)),
  role: z.enum(nonAdminRoles).optional(),
  status: z.enum(TEAM_STATUSES).optional(),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .transform((v) => Math.min(Math.max(v ?? TEAM_STATUS_PAGE_DEFAULT, 1), TEAM_STATUS_PAGE_MAX)),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type TeamStatusQueryDto = z.infer<typeof teamStatusQueryDtoSchema>;

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM");

export const staffReportQueryDtoSchema = z.object({ userId: z.string().uuid(), month });
export type StaffReportQueryDto = z.infer<typeof staffReportQueryDtoSchema>;

export const clientReportQueryDtoSchema = z.object({ clientId: z.string().uuid(), month });
export type ClientReportQueryDto = z.infer<typeof clientReportQueryDtoSchema>;
