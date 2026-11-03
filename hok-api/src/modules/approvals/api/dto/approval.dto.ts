import { z } from "zod";
import { APPROVAL_STATUSES, APPROVAL_TEXT_MAX, isValidHttpUrl } from "../../../../domain";

export const APPROVALS_DEFAULT_LIMIT = 20;
/** Page-size cap (engineering-practices §1): an over-large limit is clamped. */
export const APPROVALS_MAX_LIMIT = 100;

/** A note or comment: trimmed, blank = none. */
const text = z
  .string()
  .trim()
  .max(APPROVAL_TEXT_MAX)
  .transform((v) => (v === "" ? undefined : v));

const httpUrl = z
  .string()
  .trim()
  .max(APPROVAL_TEXT_MAX)
  .refine(isValidHttpUrl, "Use a full http(s) link, e.g. https://drive.google.com/...");

/** POST /approvals: ask for approval of the item's CURRENT stage. Strict: unknown keys are refused. */
export const requestApprovalDtoSchema = z
  .object({
    subject: z.enum(["event", "task"]),
    subjectId: z.string().uuid("subjectId must be an id"),
    note: text.optional(),
    link: z
      .union([httpUrl, z.literal("")])
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
  })
  .strict();
export type RequestApprovalDto = z.infer<typeof requestApprovalDtoSchema>;

/** POST /approvals/:id/decision (and the portal's POST /portal/:token/approvals/:id). `version` is required. */
export const decideApprovalDtoSchema = z
  .object({
    version: z.number().int().min(1),
    decision: z.enum(["approve", "changes"]),
    comment: text.optional(),
  })
  .strict();
export type DecideApprovalDto = z.infer<typeof decideApprovalDtoSchema>;

/** POST /approvals/:id/cancel */
export const cancelApprovalDtoSchema = z.object({ version: z.number().int().min(1) }).strict();
export type CancelApprovalDto = z.infer<typeof cancelApprovalDtoSchema>;

const limit = z.coerce
  .number()
  .int()
  .optional()
  .transform((v) => Math.min(Math.max(v ?? APPROVALS_DEFAULT_LIMIT, 1), APPROVALS_MAX_LIMIT));
const offset = z.coerce.number().int().min(0).optional().default(0);

/** GET /approvals: `to_decide` (default) = waiting for me, `requested` = what I asked for, `all_visible` = everything I can see. */
export const approvalQueryDtoSchema = z.object({
  view: z.enum(["to_decide", "requested", "all_visible"]).optional().default("to_decide"),
  /** Ignored by `to_decide` (that view is the pending ones by definition). */
  status: z.enum(APPROVAL_STATUSES).optional(),
  limit,
  offset,
});
export type ApprovalQueryDto = z.infer<typeof approvalQueryDtoSchema>;
