import { z } from "zod";
import { isValidTimeZone } from "../../../../domain";
import { EVENT_STATES, EVENT_TEAM_MAX, EVENT_TYPES } from "../../domain/event.entity";

/** Optional free text: trimmed, capped; "" or null clears it. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v));
}

/** An ISO-8601 instant WITH its offset ("2026-10-14T10:00:00+05:30" or "...Z"): never a zone-less wall time. */
const instant = z.string().datetime({ offset: true, message: "Use an ISO date-time with an offset, e.g. 2026-10-14T10:00:00+05:30" });
const timeZone = z.string().trim().refine(isValidTimeZone, "Must be an IANA time zone, e.g. Asia/Kolkata");
/** Profile ids, de-duplicated; validated as active accounts by the service. */
const team = z
  .array(z.string().uuid("Team members are user ids"))
  .max(EVENT_TEAM_MAX, `At most ${EVENT_TEAM_MAX} team members`)
  .transform((ids) => [...new Set(ids)]);
const version = z.number().int().min(1);

/**
 * POST /events. The event goes under one of the caller's clients, from an
 * ACTIVE stage template whose stages are copied onto it (FR-EVT-02/03); its
 * current stage starts at the first one. `timeZone` defaults to the client's.
 */
export const createEventDtoSchema = z.object({
  clientId: z.string().uuid("clientId must be a client id"),
  templateId: z.string().uuid("templateId must be a stage template id"),
  title: z.string().trim().min(1, "Please enter a title").max(160),
  type: z.enum(EVENT_TYPES),
  startsAt: instant,
  endsAt: instant,
  timeZone: timeZone.optional(),
  location: optionalText(500),
  description: optionalText(5000),
  assignedTeam: team.optional(),
});
export type CreateEventDto = z.infer<typeof createEventDtoSchema>;

/**
 * PATCH /events/:id: edit, reschedule (startsAt/endsAt), cancel / postpone /
 * reactivate (`state`). `version` required. The client, template and stages
 * never change after creation; the stage moves through POST /events/:id/stage.
 */
export const updateEventDtoSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  type: z.enum(EVENT_TYPES).optional(),
  startsAt: instant.optional(),
  endsAt: instant.optional(),
  timeZone: timeZone.optional(),
  location: optionalText(500),
  description: optionalText(5000),
  assignedTeam: team.optional(),
  state: z.enum(EVENT_STATES).optional(),
  version,
});
export type UpdateEventDto = z.infer<typeof updateEventDtoSchema>;

/** POST /events/:id/stage (FR-EVT-06). `visibleToClient` shows the note on the client portal (M8). */
export const moveStageDtoSchema = z.object({
  stageId: z.string().uuid("stageId must be a stage id"),
  note: optionalText(1000),
  visibleToClient: z.boolean().optional().default(false),
  version,
});
export type MoveStageDto = z.infer<typeof moveStageDtoSchema>;

export const EVENTS_DEFAULT_LIMIT = 50;
/** Higher than other lists' 100: a calendar range wants a month at once. Still capped. */
export const EVENTS_MAX_LIMIT = 200;

/**
 * GET /events: the client workspace's Events tab (`clientId`) and the
 * calendars (`from` + `to`, instants, at most 92 days; returns events that
 * overlap the range, earliest first). Without a range: newest first.
 * `ownerId` is the Admin's filter, ignored for a manager.
 */
export const eventQueryDtoSchema = z.object({
  clientId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  from: instant.optional(),
  to: instant.optional(),
  state: z.enum(EVENT_STATES).optional(),
  type: z.enum(EVENT_TYPES).optional(),
  search: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v ? v : undefined)),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .transform((v) => Math.min(Math.max(v ?? EVENTS_DEFAULT_LIMIT, 1), EVENTS_MAX_LIMIT)),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type EventQueryDto = z.infer<typeof eventQueryDtoSchema>;
