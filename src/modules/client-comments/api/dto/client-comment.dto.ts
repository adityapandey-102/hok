import { z } from "zod";
import { COMMENT_BODY_MAX, COMMENT_REPLY_MAX, COMMENT_STATUSES } from "../../domain/client-comment.entity";

export const COMMENTS_DEFAULT_LIMIT = 20;
/** Page-size cap (engineering-practices §1): an over-large limit is clamped. */
export const COMMENTS_MAX_LIMIT = 100;

const limit = z.coerce
  .number()
  .int()
  .optional()
  .transform((v) => Math.min(Math.max(v ?? COMMENTS_DEFAULT_LIMIT, 1), COMMENTS_MAX_LIMIT));
const offset = z.coerce.number().int().min(0).optional().default(0);

/** GET /client-comments: no status = the open inbox (received + in progress). */
export const commentQueryDtoSchema = z.object({
  clientId: z.string().uuid("clientId must be a client id").optional(),
  /** Comment text or client name, case-insensitive; blank = no search. */
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : undefined)),
  status: z.enum(COMMENT_STATUSES).optional(),
  limit,
  offset,
});
export type CommentQueryDto = z.infer<typeof commentQueryDtoSchema>;

/** PATCH /client-comments/:id: a new status and/or a reply ("" or null clears it); version required. */
export const updateCommentDtoSchema = z.object({
  status: z.enum(COMMENT_STATUSES).optional(),
  reply: z
    .union([z.string().trim().max(COMMENT_REPLY_MAX), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  version: z.number().int().min(1),
});
export type UpdateCommentDto = z.infer<typeof updateCommentDtoSchema>;

/** Public: GET /portal/:token/comments. */
export const portalCommentQueryDtoSchema = z.object({ limit, offset });

/** Public: POST /portal/:token/comments (FR-CMT-01). Strict: unknown keys are refused. */
export const postCommentDtoSchema = z
  .object({
    body: z.string().trim().min(1, "Write a comment").max(COMMENT_BODY_MAX),
    eventId: z.string().uuid().nullish(),
  })
  .strict();
export type PostCommentDto = z.infer<typeof postCommentDtoSchema>;
