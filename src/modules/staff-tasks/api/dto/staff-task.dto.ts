import { z } from "zod";
import { ROLES, URL_MAX_LENGTH, isValidHttpUrl } from "../../../../domain";
import {
  COMMENT_MAX_LENGTH,
  OPEN_STAFF_TASK_STATUSES,
  REFERENCE_LINKS_MAX,
  SCRIPT_MAX_LENGTH,
  STAFF_TASK_PRIORITIES,
  STAFF_TASK_STATUSES,
} from "../../domain/staff-task.entity";

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

/** Optional http(s) link; "" or null clears it. Refuses javascript:/data: links. */
const optionalUrl = optionalText(URL_MAX_LENGTH).refine((v) => v == null || isValidHttpUrl(v), "Use a full http(s) link, e.g. https://drive.google.com/...");

/** An ISO-8601 instant WITH its offset; null clears the due date. */
const dueAt = z
  .string()
  .datetime({ offset: true, message: "Use an ISO date-time with an offset, e.g. 2026-10-20T18:00:00+05:30" })
  .nullable()
  .optional();

const referenceLinks = z
  .array(
    z.object({
      url: z.string().trim().max(URL_MAX_LENGTH).refine(isValidHttpUrl, "Use a full http(s) link"),
      label: optionalText(120).transform((v) => v ?? null),
    }),
  )
  .max(REFERENCE_LINKS_MAX, `At most ${REFERENCE_LINKS_MAX} reference links`);

const version = z.number().int().min(1);
const optionalComment = optionalText(COMMENT_MAX_LENGTH);

const fieldSchemas = {
  title: z.string().trim().min(1, "Please enter a title").max(160),
  description: optionalText(5000),
  clientId: z.string().uuid("clientId must be a client id").nullable().optional(),
  eventId: z.string().uuid("eventId must be an event id").nullable().optional(),
  dueAt,
  priority: z.enum(STAFF_TASK_PRIORITIES).optional(),
  // FR-TSK-10 editor brief: required/refused by the assignee's role in the service.
  rawFilesUrl: optionalUrl,
  referenceUrl: optionalUrl,
  script: optionalText(SCRIPT_MAX_LENGTH),
  referenceLinks: referenceLinks.optional(),
};

/**
 * POST /staff-tasks (Admin). Exactly one assignee, any active staff member.
 * Editor tasks need `rawFilesUrl`; other roles may not carry the editor fields.
 * Priority defaults to medium; a new task starts as `todo`.
 */
export const createStaffTaskDtoSchema = z.object({
  ...fieldSchemas,
  assigneeId: z.string().uuid("assigneeId must be a user id"),
});
export type CreateStaffTaskDto = z.infer<typeof createStaffTaskDtoSchema>;

/**
 * PATCH /staff-tasks/:id (Admin): edit and/or reassign (`assigneeId`).
 * `version` required. Status moves through /status and /reopen.
 */
export const updateStaffTaskDtoSchema = z.object({
  ...fieldSchemas,
  title: fieldSchemas.title.optional(),
  assigneeId: z.string().uuid("assigneeId must be a user id").optional(),
  version,
});
export type UpdateStaffTaskDto = z.infer<typeof updateStaffTaskDtoSchema>;

/** POST /staff-tasks/:id/status (assignee or Admin), with an optional comment. */
export const changeStatusDtoSchema = z.object({
  status: z.enum(STAFF_TASK_STATUSES),
  comment: optionalComment,
  version,
});
export type ChangeStatusDto = z.infer<typeof changeStatusDtoSchema>;

/** POST /staff-tasks/:id/reopen (Admin): a done task back to an open status (default todo). */
export const reopenDtoSchema = z.object({
  status: z.enum(OPEN_STAFF_TASK_STATUSES).optional().default("todo"),
  comment: optionalComment,
  version,
});
export type ReopenDto = z.infer<typeof reopenDtoSchema>;

/** POST /staff-tasks/:id/comments (assignee or Admin). */
export const commentDtoSchema = z.object({
  body: z.string().trim().min(1, "Write a comment").max(COMMENT_MAX_LENGTH),
});
export type CommentDto = z.infer<typeof commentDtoSchema>;

export const STAFF_TASKS_DEFAULT_LIMIT = 20;
/** Page-size cap (docs/engineering-practices.md §1). */
export const STAFF_TASKS_MAX_LIMIT = 100;

const flag = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

/**
 * GET /staff-tasks. Parsed strictly: an unknown status/priority/role, a bad id
 * or instant, or a non-numeric limit is a 400; limit is clamped to 1..100.
 * `assigneeId`, `role` and `clientId` are the Admin's filters (ignored for an
 * assignee, whose list is always their own tasks).
 */
export const staffTaskQueryDtoSchema = z.object({
  status: z.enum(STAFF_TASK_STATUSES).optional(),
  /** `open=true`: everything but done. */
  open: flag,
  priority: z.enum(STAFF_TASK_PRIORITIES).optional(),
  assigneeId: z.string().uuid("assigneeId must be a user id").optional(),
  role: z.enum(ROLES).optional(),
  clientId: z.string().uuid("clientId must be a client id").optional(),
  /** `overdue=true`: past due and not done. */
  overdue: flag,
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
    .transform((v) => Math.min(Math.max(v ?? STAFF_TASKS_DEFAULT_LIMIT, 1), STAFF_TASKS_MAX_LIMIT)),
  offset: z.coerce.number().int().min(0).optional().default(0),
})
  .refine((q) => !q.dueFrom || !q.dueTo || new Date(q.dueFrom) < new Date(q.dueTo), { path: ["dueTo"], message: "dueTo must be after dueFrom" });
export type StaffTaskQueryDto = z.infer<typeof staffTaskQueryDtoSchema>;
