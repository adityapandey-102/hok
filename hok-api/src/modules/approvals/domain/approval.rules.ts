import { ConflictError, ForbiddenError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { canManageApprovalItem, canMoveApprovalItem, canSeeApprovalItem, type ApprovalCaller, type ApprovalItemRef } from "../../../domain";
import type { ApprovalItemFacts } from "./approval.entity";

/**
 * Approval rules (round 3). The pure ones -- the move gate, who may decide, no self-approval -- live in the shared
 * kernel (src/domain/stage-approvals.ts, ADR 0003) because events and staff tasks need them too; this file adds the
 * request-time checks, which only the approvals module makes. Pure functions that throw AppError (ADR 0002).
 */
export {
  APPROVAL_TEXT_MAX,
  assertApproversValid,
  assertCanDecide,
  assertCanPass,
  assertDecisionComment,
  canCancelApproval,
  canDecide,
  decisionRefusal,
  maxReachablePosition,
} from "../../../domain";

const notFound = (subject: "event" | "task") =>
  subject === "event"
    ? new NotFoundError("Event not found", ERROR_CODES.EVENT_NOT_FOUND)
    : new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);

/** The facts as the visibility rules read them. */
export function itemRefOf(item: ApprovalItemFacts): ApprovalItemRef {
  return { subject: item.subject, teamIds: item.teamIds, assigneeId: item.assigneeId, assignedBy: item.assignedBy };
}

/**
 * Asking for approval on the item's CURRENT stage. In order:
 *  - the item must exist and be visible to the caller (404, the item's own code);
 *  - the caller must be able to move it (403): events = Admin or a manager on the client's team; tasks = assignee, creator, Admin;
 *  - a cancelled or postponed event (409 EVENT_NOT_ACTIVE), a done task (409 STAFF_TASK_DONE), an archived client (409 CLIENT_ARCHIVED);
 *  - the stage needs approval at all (409 STAGE_APPROVAL_NOT_NEEDED), isn't approved already (409 STAGE_APPROVAL_ALREADY_APPROVED)
 *    and has no request waiting (409 STAGE_APPROVAL_PENDING).
 */
export function assertCanRequest(caller: ApprovalCaller, item: ApprovalItemFacts | null, subject: "event" | "task"): ApprovalItemFacts {
  if (!item) throw notFound(subject);
  const ref = itemRefOf(item);
  if (!canSeeApprovalItem(caller, ref)) throw notFound(item.subject);
  if (!canMoveApprovalItem(caller, ref)) {
    throw item.subject === "event"
      ? new ForbiddenError("Only the Admin or a manager on this client's team can ask for approval", ERROR_CODES.FORBIDDEN)
      : new ForbiddenError("Only the assignee, the creator or the Admin can ask for approval", ERROR_CODES.STAFF_TASK_FORBIDDEN);
  }
  if (item.inactive === "event_not_active") {
    throw new ConflictError("Only an active event can be sent for approval. Set it back to active first.", ERROR_CODES.EVENT_NOT_ACTIVE);
  }
  if (item.inactive === "task_done") throw new ConflictError("This task is already done", ERROR_CODES.STAFF_TASK_DONE);
  if (item.clientArchived) {
    throw new ConflictError("This client is archived, so its work is read-only. Unarchive the client first.", ERROR_CODES.CLIENT_ARCHIVED);
  }
  if (item.approvers.length === 0) {
    throw new ConflictError("This stage doesn't need approval", ERROR_CODES.STAGE_APPROVAL_NOT_NEEDED);
  }
  if (item.approved) throw new ConflictError("This stage is already approved", ERROR_CODES.STAGE_APPROVAL_ALREADY_APPROVED);
  if (item.pending) throw new ConflictError("A request for this stage is already waiting", ERROR_CODES.STAGE_APPROVAL_PENDING);
  return item;
}

/** Another person's item is the same 404 as a missing approval (no existence leak). */
export function assertApprovalVisible<T extends { record: { subject: "event" | "task" }; teamIds: string[]; assigneeId: string | null; assignedBy: string | null }>(
  caller: ApprovalCaller,
  row: T | null,
): T {
  if (!row || !canSeeApprovalItem(caller, { subject: row.record.subject, teamIds: row.teamIds, assigneeId: row.assigneeId, assignedBy: row.assignedBy })) {
    throw new NotFoundError("Approval not found", ERROR_CODES.STAGE_APPROVAL_NOT_FOUND);
  }
  return row;
}

/** Only a waiting request can be decided or cancelled (409 STAGE_APPROVAL_NOT_PENDING). */
export function assertPending(status: string): void {
  if (status !== "pending") throw new ConflictError("This request has already been dealt with", ERROR_CODES.STAGE_APPROVAL_NOT_PENDING);
}

/** Optimistic lock (409 STAGE_APPROVAL_MODIFIED). */
export function assertApprovalVersion(current: number, given: number): void {
  if (current !== given) {
    throw new ConflictError("This request was changed by someone else. Reload and try again.", ERROR_CODES.STAGE_APPROVAL_MODIFIED);
  }
}

/** Withdrawing: the requester, or whoever manages the item (403 FORBIDDEN otherwise -- the caller already sees the item). */
export function assertCanCancel(caller: ApprovalCaller, row: { record: { requestedById: string | null; subject: "event" | "task" }; teamIds: string[]; assigneeId: string | null; assignedBy: string | null }): void {
  const manage = canManageApprovalItem(caller, { subject: row.record.subject, teamIds: row.teamIds, assigneeId: row.assigneeId, assignedBy: row.assignedBy });
  if (!manage && row.record.requestedById !== caller.userId) {
    throw new ForbiddenError("Only the person who asked, or a manager of this item, can cancel the request", ERROR_CODES.FORBIDDEN);
  }
}
