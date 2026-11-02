import { z } from "zod";
import { EVENT_STATES, EVENT_TYPES } from "../../../events/domain/event.entity";

const instant = z.string().datetime({ offset: true, message: "Use an ISO date-time with an offset, e.g. 2026-10-01T00:00:00+05:30" });

/**
 * GET /calendar. `from` + `to` are required (≤ 92 days; the web computes
 * them from the viewer's zone). `include` picks the kinds (default all).
 * `ownerId` is the Admin's filter (events, personal entries and tasks; never
 * to-dos). `eventType` / `state` filter client events and, when set, leave
 * every other kind out; `clientId` also leaves out to-dos.
 */
export const calendarQueryDtoSchema = z.object({
  from: instant,
  to: instant,
  include: z.enum(["all", "events", "personal", "tasks", "todos"]).optional().default("all"),
  clientId: z.string().uuid().optional(),
  ownerId: z.string().uuid().optional(),
  eventType: z.enum(EVENT_TYPES).optional(),
  state: z.enum(EVENT_STATES).optional(),
});
export type CalendarQueryDto = z.infer<typeof calendarQueryDtoSchema>;
