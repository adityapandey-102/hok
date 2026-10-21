import { z } from "zod";
import { ACTIVITY_FILTER_KINDS, ACTIVITY_PAGE_DEFAULT, ACTIVITY_PAGE_MAX } from "../../domain/activity.entity";

const instant = z
  .string()
  .datetime({ offset: true })
  .transform((v) => new Date(v));

/** GET /activity: instants, kind, person, paged (limit <= 50). Parsed strictly: a bad value is a 400. */
export const activityQueryDtoSchema = z.object({
  from: instant.optional(),
  to: instant.optional(),
  kind: z.enum(ACTIVITY_FILTER_KINDS).optional().default("all"),
  actorId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(ACTIVITY_PAGE_MAX).optional().default(ACTIVITY_PAGE_DEFAULT),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type ActivityQueryDto = z.infer<typeof activityQueryDtoSchema>;
