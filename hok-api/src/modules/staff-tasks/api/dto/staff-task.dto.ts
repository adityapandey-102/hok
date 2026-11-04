import { z } from "zod";
import { ROLES, isValidHttpUrl } from "../../../../domain";
import {
  BLOCK_REASON_MAX_LENGTH,
  BRIEF_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  STAFF_TASK_RELATIONS,
  STAFF_TASK_PRIORITIES,
  STAFF_TASK_STATUSES,
  TASK_CREATE_LINKS_MAX,
  TASK_LINK_KINDS,
  TASK_LINK_LABEL_MAX_LENGTH,
  TASK_LINK_URL_MAX_LENGTH,
} from "../../domain/staff-task.entity";

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

/** A required http(s) link (refuses javascript:/data: links). */
const httpUrl = z.string().trim().max(TASK_LINK_URL_MAX_LENGTH).refine(isValidHttpUrl, "Use a full http(s) link, e.g. https://drive.google.com/...");

/** An optional link label; blank or null means none. */
const linkLabel = optionalText(TASK_LINK_LABEL_MAX_LENGTH).transform((v) => v ?? null);

/** An ISO-8601 instant WITH its offset; null clears the due date. */
const dueAt = z
  .string()
  .datetime({ offset: true, message: "Use an ISO date-time with an offset, e.g. 2026-10-20T18:00:00+05:30" })
  .nullable()
  .optional();

const version = z.number().int().min(1);
const optionalComment = optionalText(COMMENT_MAX_LENGTH);

const fieldSchemas = {
  title: z.string().trim().min(1, "Please enter a title").max(160),
  description: optionalText(5000),
  /** Instructions or a script for the assignee; any task. */
  brief: optionalText(BRIEF_MAX_LENGTH),
  clientId: z.string().uuid("clientId must be a client id").nullable().optional(),
  eventId: z.string().uuid("eventId must be an event id").nullable().optional(),
  dueAt,
  priority: z.enum(STAFF_TASK_PRIORITIES).optional(),
};

/**
 * POST /staff-tasks (Admin or a client manager). Exactly one active assignee
 * whose role is below the caller's on the ladder, and a task template (kind
 * "task", active, offered for the assignee's role) whose stages the task
 * snapshots. `links` are brief links added at creation. Priority defaults to
 * medium; a new task starts at stage 1 (status `todo`).
 */
export const createStaffTaskDtoSchema = z.object({
  ...fieldSchemas,
  assigneeId: z.string().uuid("assigneeId must be a user id"),
  templateId: z.string().uuid("templateId must be a task template id"),
  links: z
    .array(z.object({ url: httpUrl, label: linkLabel }))
    .max(TASK_CREATE_LINKS_MAX, `At most ${TASK_CREATE_LINKS_MAX} links`)
    .optional(),
  /** Round 4: make this task a part (child) of a stage of an event or another task. */
  parent: z
    .object({
      kind: z.enum(["event", "task"]),
      id: z.string().uuid("parent.id must be an event or task id"),
      stageId: z.string().uuid("parent.stageId must be a stage id"),
    })
    .optional(),
});
export type CreateStaffTaskDto = z.infer<typeof createStaffTaskDtoSchema>;

/**
 * PATCH /staff-tasks/:id (Admin, or the creator): edit and/or reassign (`assigneeId`).
 * `version` required. The stages are fixed once created, so there is no templateId
 * (sending one is a 400); stage moves, blocking and reopening have their own endpoints.
 */
export const updateStaffTaskDtoSchema = z
  .object({
    ...fieldSchemas,
    title: fieldSchemas.title.optional(),
    assigneeId: z.string().uuid("assigneeId must be a user id").optional(),
    version,
  })
  .strict();
export type UpdateStaffTaskDto = z.infer<typeof updateStaffTaskDtoSchema>;

/**
 * POST /staff-tasks/:id/stage (assignee, creator or Admin): EXACTLY ONE of `stageId` (move to
 * that stage, forward or back) or `complete: true` (only from the last stage), plus an optional comment.
 */
export const stageMoveDtoSchema = z
  .object({
    stageId: z.string().uuid("stageId must be a stage id").optional(),
    complete: z.literal(true).optional(),
    comment: optionalComment,
    version,
  })
  .refine((b) => (b.stageId === undefined) !== (b.complete === undefined), { path: ["stageId"], message: "Send either stageId or complete: true" });
export type StageMoveDto = z.infer<typeof stageMoveDtoSchema>;

/** POST /staff-tasks/:id/block (assignee or Admin): the reason is required. */
export const blockDtoSchema = z.object({
  reason: z.string().trim().min(1, "Say what is blocking the task").max(BLOCK_REASON_MAX_LENGTH),
  version,
});
export type BlockDto = z.infer<typeof blockDtoSchema>;

/** POST /staff-tasks/:id/unblock (assignee, creator or Admin), with an optional comment. */
export const unblockDtoSchema = z.object({ comment: optionalComment, version });
export type UnblockDto = z.infer<typeof unblockDtoSchema>;

/**
 * POST /staff-tasks/:id/reopen (Admin or the creator): a done task back to `stageId`
 * (default: its last stage), with an optional comment.
 */
export const reopenDtoSchema = z.object({
  stageId: z.string().uuid("stageId must be a stage id").optional(),
  comment: optionalComment,
  version,
});
export type ReopenDto = z.infer<typeof reopenDtoSchema>;

/** POST /staff-tasks/:id/comments (assignee, creator or Admin). */
export const commentDtoSchema = z.object({
  body: z.string().trim().min(1, "Write a comment").max(COMMENT_MAX_LENGTH),
});
export type CommentDto = z.infer<typeof commentDtoSchema>;

/**
 * POST /staff-tasks/:id/links: a brief link (inputs; the creator, a manager or the Admin) or a
 * delivered one (finished work; the assignee or the Admin). `stageId` ties it to one of the task's stages.
 */
export const addLinkDtoSchema = z.object({
  kind: z.enum(TASK_LINK_KINDS),
  url: httpUrl,
  label: linkLabel,
  stageId: z.string().uuid("stageId must be a stage id").nullable().optional(),
});
export type AddLinkDto = z.infer<typeof addLinkDtoSchema>;

/**
 * POST /staff-tasks/:id/links/:linkId/share: turns a delivered link into a client-visible asset
 * on the task's event. `title` defaults to the link's label; `stageId` is one of the EVENT's stages.
 */
export const shareLinkDtoSchema = z.object({
  title: optionalText(160).transform((v) => v ?? null),
  stageId: z.string().uuid("stageId must be an event stage id").nullable().optional(),
});
export type ShareLinkDto = z.infer<typeof shareLinkDtoSchema>;

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
 * `assigneeId`, `role` and `clientId` are open to every caller and always ANDed
 * with their row scope; `relation` narrows to assigned-to-me / created-by-me /
 * my-client-teams.
 */
export const staffTaskQueryDtoSchema = z.object({
  status: z.enum(STAFF_TASK_STATUSES).optional(),
  /** `open=true`: everything but done. */
  open: flag,
  priority: z.enum(STAFF_TASK_PRIORITIES).optional(),
  assigneeId: z.string().uuid("assigneeId must be a user id").optional(),
  role: z.enum(ROLES).optional(),
  clientId: z.string().uuid("clientId must be a client id").optional(),
  relation: z.enum(STAFF_TASK_RELATIONS).optional(),
  /** `overdue=true`: past due and not done. */
  overdue: flag,
  dueFrom: z.string().datetime({ offset: true }).optional(),
  dueTo: z.string().datetime({ offset: true }).optional(),
  search: z
    .string()
    .trim()
    .max(80)
    .transform((v) => (v ? v : undefined))
    .optional(),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .transform((v) => Math.min(Math.max(v ?? STAFF_TASKS_DEFAULT_LIMIT, 1), STAFF_TASKS_MAX_LIMIT)),
  offset: z.coerce.number().int().min(0).optional().default(0),
})
  .refine((q) => !q.dueFrom || !q.dueTo || new Date(q.dueFrom) < new Date(q.dueTo), { path: ["dueTo"], message: "dueTo must be after dueFrom" });
export type StaffTaskQueryDto = z.infer<typeof staffTaskQueryDtoSchema>;
