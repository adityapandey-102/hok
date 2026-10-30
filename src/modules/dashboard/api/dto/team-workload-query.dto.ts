import { z } from "zod";
import { ROLES } from "../../../../domain";
import { TEAM_PAGE_DEFAULT, TEAM_PAGE_MAX } from "../../domain/dashboard.entity";

/** GET /dashboard/team: name search, role (never admin: the Admin assigns, isn't assigned), paged (≤ 50). Parsed strictly. */
export const teamWorkloadQueryDtoSchema = z.object({
  search: z
    .string()
    .trim()
    .max(80)
    
    .transform((v) => (v ? v : undefined)).optional(),
  role: z.enum(ROLES.filter((r) => r !== "admin") as [Exclude<(typeof ROLES)[number], "admin">, ...Exclude<(typeof ROLES)[number], "admin">[]]).optional(),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .transform((v) => Math.min(Math.max(v ?? TEAM_PAGE_DEFAULT, 1), TEAM_PAGE_MAX)),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type TeamWorkloadQueryDto = z.infer<typeof teamWorkloadQueryDtoSchema>;
