import { z } from "zod";
import {
  CLIENT_TODO_DESCRIPTION_MAX,
  CLIENT_TODO_PRIORITIES,
  CLIENT_TODO_STATUSES,
  CLIENT_TODO_TITLE_MAX,
} from "../../domain/client-todo.entity";

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

const version = z.number().int().min(1);
/** An ISO-8601 instant WITH its offset; null clears the due date. */
const dueAt = z
  .string()
  .datetime({ offset: true, message: "Use an ISO date-time with an offset, e.g. 2026-10-20T18:00:00+05:30" })
  .nullable()
  .optional();
const eventId = z.string().uuid("eventId must be an event id").nullable().optional();

/** POST /clients/:clientId/todos. Status always starts as todo; `eventId` (optional) must be one of the client's events. */
export const createClientTodoDtoSchema = z.object({
  title: z.string().trim().min(1, "Please enter a title").max(CLIENT_TODO_TITLE_MAX),
  description: optionalText(CLIENT_TODO_DESCRIPTION_MAX),
  dueAt,
  priority: z.enum(CLIENT_TODO_PRIORITIES).optional(),
  eventId,
});
export type CreateClientTodoDto = z.infer<typeof createClientTodoDtoSchema>;

/**
 * PATCH /client-todos/:id. Every field optional (at least one, or 400
 * VALIDATION_NO_FIELDS); `version` required (stale = 409 CLIENT_TODO_MODIFIED).
 * `status: done` stamps completed_at, reopening clears it. `eventId: null` unlinks.
 */
export const updateClientTodoDtoSchema = z.object({
  title: z.string().trim().min(1, "Please enter a title").max(CLIENT_TODO_TITLE_MAX).optional(),
  description: optionalText(CLIENT_TODO_DESCRIPTION_MAX),
  dueAt,
  priority: z.enum(CLIENT_TODO_PRIORITIES).optional(),
  status: z.enum(CLIENT_TODO_STATUSES).optional(),
  eventId,
  version,
});
export type UpdateClientTodoDto = z.infer<typeof updateClientTodoDtoSchema>;

/** DELETE /client-todos/:id?version= -- version optional (the UI sends it; a stale one is 409). */
export const deleteClientTodoQuerySchema = z.object({ version: z.coerce.number().int().min(1).optional() });
export type DeleteClientTodoQuery = z.infer<typeof deleteClientTodoQuerySchema>;

export const CLIENT_TODOS_DEFAULT_LIMIT = 20;
/** Page-size cap (docs/engineering-practices.md section 1): an over-large limit is clamped, never honoured. */
export const CLIENT_TODOS_MAX_LIMIT = 100;

const flag = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

/**
 * GET /clients/:clientId/todos. Parsed strictly: an unknown status/priority,
 * a bad instant or a non-numeric limit is a 400; limit is clamped to 1..100.
 * Without `status`, the list is the open to-dos (not done); `status=all`
 * lists every status (the web's "All" tab).
 */
export const clientTodoQueryDtoSchema = z.object({
  status: z.enum([...CLIENT_TODO_STATUSES, "all"]).optional(),
  priority: z.enum(CLIENT_TODO_PRIORITIES).optional(),
  /** `overdue=true`: past due and not done. */
  overdue: flag,
  /** `dueFrom` inclusive, `dueTo` exclusive. */
  dueFrom: z.string().datetime({ offset: true }).optional(),
  dueTo: z.string().datetime({ offset: true }).optional(),
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
    .transform((v) => Math.min(Math.max(v ?? CLIENT_TODOS_DEFAULT_LIMIT, 1), CLIENT_TODOS_MAX_LIMIT)),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type ClientTodoQueryDto = z.infer<typeof clientTodoQueryDtoSchema>;
