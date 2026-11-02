import { z } from "zod";
import { TODO_NOTES_MAX, TODO_STATUS_FILTERS, TODO_TITLE_MAX, TODO_URGENCIES } from "../../domain/todo.entity";

/** Optional free text: trimmed, capped; "" or null clears it. */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional();
}

/** An ISO-8601 instant WITH its offset; null clears the due date. */
const dueAt = z
  .string()
  .datetime({ offset: true, message: "Use an ISO date-time with an offset, e.g. 2026-11-10T18:00:00+05:30" })
  .nullable()
  .optional();

const title = z.string().trim().min(1, "Please enter a title").max(TODO_TITLE_MAX);

/** POST /todos. Owned by the caller; urgency defaults to medium. Unknown keys are refused. */
export const createTodoDtoSchema = z
  .object({
    title,
    notes: optionalText(TODO_NOTES_MAX),
    dueAt,
    urgency: z.enum(TODO_URGENCIES).optional(),
  })
  .strict();
export type CreateTodoDto = z.infer<typeof createTodoDtoSchema>;

/**
 * PATCH /todos/:id. `version` required (stale = 409 TODO_MODIFIED); at least
 * one other field (400 VALIDATION_NO_FIELDS). `dueAt: null` clears the due
 * date; `done` ticks / unticks. Unknown keys are refused.
 */
export const updateTodoDtoSchema = z
  .object({
    title: title.optional(),
    notes: optionalText(TODO_NOTES_MAX),
    dueAt,
    urgency: z.enum(TODO_URGENCIES).optional(),
    done: z.boolean().optional(),
    version: z.number().int().min(1),
  })
  .strict();
export type UpdateTodoDto = z.infer<typeof updateTodoDtoSchema>;

export const TODOS_DEFAULT_LIMIT = 50;
/** Page-size cap (docs/engineering-practices.md section 1): an over-large limit is clamped, never honoured. */
export const TODOS_MAX_LIMIT = 100;

/**
 * GET /todos. Parsed strictly: an unknown status, a bad instant or a
 * non-numeric limit is a 400; limit is clamped to 1..100. Without `status`,
 * the list is the open to-dos.
 */
export const todoQueryDtoSchema = z
  .object({
    status: z.enum(TODO_STATUS_FILTERS).optional().default("open"),
    /** `dueFrom` inclusive, `dueTo` exclusive. */
    dueFrom: z.string().datetime({ offset: true }).optional(),
    dueTo: z.string().datetime({ offset: true }).optional(),
    limit: z.coerce
      .number()
      .int()
      .optional()
      .transform((v) => Math.min(Math.max(v ?? TODOS_DEFAULT_LIMIT, 1), TODOS_MAX_LIMIT)),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .refine((q) => !q.dueFrom || !q.dueTo || new Date(q.dueFrom) < new Date(q.dueTo), { path: ["dueTo"], message: "dueTo must be after dueFrom" });
export type TodoQueryDto = z.infer<typeof todoQueryDtoSchema>;
