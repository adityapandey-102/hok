import { z } from "zod";
import { ROLES } from "../../../../domain";

export const USERS_DEFAULT_LIMIT = 20;
/** Page-size cap (docs/engineering-practices.md §1): an over-large limit is clamped, never honoured. */
export const USERS_MAX_LIMIT = 100;

/**
 * GET /users query. Parsed strictly: a non-numeric limit/offset or an unknown
 * role is a 400 (never silently ignored), while an out-of-range limit is
 * clamped to 1..100 -- needleye's users-list behaviour.
 */
export const userQueryDtoSchema = z.object({
  /** Name or email contains (case-insensitive). */
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
    .transform((v) => Math.min(Math.max(v ?? USERS_DEFAULT_LIMIT, 1), USERS_MAX_LIMIT)),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type UserQueryDto = z.infer<typeof userQueryDtoSchema>;
