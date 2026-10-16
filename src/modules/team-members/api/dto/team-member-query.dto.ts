import { z } from "zod";
import { ROLES } from "../../../../domain";

export const TEAM_DEFAULT_LIMIT = 20;
export const TEAM_MAX_LIMIT = 100;

/** GET /team-members: active staff only; name search; optional role; paged (≤ 100). Parsed strictly like GET /users. */
export const teamMemberQueryDtoSchema = z.object({
  search: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v : undefined)),
  role: z.enum(ROLES).optional(),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .transform((v) => Math.min(Math.max(v ?? TEAM_DEFAULT_LIMIT, 1), TEAM_MAX_LIMIT)),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type TeamMemberQueryDto = z.infer<typeof teamMemberQueryDtoSchema>;
