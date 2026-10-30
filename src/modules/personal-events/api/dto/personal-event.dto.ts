import { z } from "zod";
import { isValidTimeZone } from "../../../../domain";

/** An ISO-8601 instant WITH an offset ("...+05:30" or "...Z"), never a zone-less wall time. */
const instant = z.string().datetime({ offset: true, message: "Use an ISO date-time with an offset, e.g. 2026-10-14T10:00:00+05:30" });
const timeZone = z.string().trim().refine(isValidTimeZone, "Must be an IANA time zone, e.g. Asia/Kolkata");
const description = z
  .string()
  .trim()
  .max(5000)
  .nullable()
  
  .transform((v) => (v === "" ? null : v)).optional();

/** POST /personal-events. Owned by the caller; `timeZone` defaults to their profile's; `clientId` must be one of their own clients. */
export const createPersonalEventDtoSchema = z.object({
  title: z.string().trim().min(1, "Please enter a title").max(160),
  startsAt: instant,
  endsAt: instant,
  timeZone: timeZone.optional(),
  description,
  clientId: z.string().uuid().nullable().optional(),
});
export type CreatePersonalEventDto = z.infer<typeof createPersonalEventDtoSchema>;

/** PATCH /personal-events/:id. `clientId: null` unlinks. `version` required. */
export const updatePersonalEventDtoSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  startsAt: instant.optional(),
  endsAt: instant.optional(),
  timeZone: timeZone.optional(),
  description,
  clientId: z.string().uuid().nullable().optional(),
  version: z.number().int().min(1),
});
export type UpdatePersonalEventDto = z.infer<typeof updatePersonalEventDtoSchema>;

export const PERSONAL_EVENTS_DEFAULT_LIMIT = 50;
export const PERSONAL_EVENTS_MAX_LIMIT = 200;

/** GET /personal-events. Range optional here (both or neither, ≤ 92 days); `ownerId` is the Admin's filter. */
export const personalEventQueryDtoSchema = z.object({
  from: instant.optional(),
  to: instant.optional(),
  clientId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .transform((v) => Math.min(Math.max(v ?? PERSONAL_EVENTS_DEFAULT_LIMIT, 1), PERSONAL_EVENTS_MAX_LIMIT)),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type PersonalEventQueryDto = z.infer<typeof personalEventQueryDtoSchema>;
