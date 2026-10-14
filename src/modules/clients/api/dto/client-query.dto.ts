import { z } from "zod";
import { CLIENT_STATUSES } from "../../domain/client.entity";

export const CLIENTS_DEFAULT_LIMIT = 20;
/** Page-size cap (docs/engineering-practices.md §1): an over-large limit is clamped, never honoured. */
export const CLIENTS_MAX_LIMIT = 100;

const blankToUndefined = (v: string | undefined) => (v ? v : undefined);

/**
 * GET /clients query. Parsed strictly like GET /users: an unknown status, a
 * malformed ownerId or a non-numeric limit/offset is a 400; an out-of-range
 * limit is clamped to 1..100.
 *
 * - no `status`: active and paused clients (archived ones are hidden, FR-CLI-07);
 *   `status=archived` lists only the archived ones.
 * - `ownerId`: the Admin's owner filter (FR-CLI-04). Ignored for a manager,
 *   whose list is always their own clients.
 */
export const clientQueryDtoSchema = z.object({
  /** Business name contains (case-insensitive). */
  search: z.string().trim().max(80).optional().transform(blankToUndefined),
  status: z.enum(CLIENT_STATUSES).optional(),
  /** Case-insensitive exact match. */
  industry: z.string().trim().max(80).optional().transform(blankToUndefined),
  ownerId: z.string().uuid("ownerId must be a user id").optional(),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .transform((v) => Math.min(Math.max(v ?? CLIENTS_DEFAULT_LIMIT, 1), CLIENTS_MAX_LIMIT)),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ClientQueryDto = z.infer<typeof clientQueryDtoSchema>;
