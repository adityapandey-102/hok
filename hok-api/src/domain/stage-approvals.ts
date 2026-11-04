import { BadRequestError, ConflictError, ForbiddenError } from "../common/errors/app-error";
import { ERROR_CODES } from "../common/errors/error-codes";
import { hasCapability } from "./capabilities";
import { isClientManager, ROLES, type Role } from "./roles";

/**
 * Stage approvals (round 3): the pure rules, in the shared kernel because three modules
 * need them -- stage templates validate approvers, events and staff tasks run the move gate,
 * and the approvals module decides who may approve. (ADR 0003: a module's Application layer
 * never imports another module's, so the rules live here, once.)
 *
 * An APPROVAL STAGE is a stage with at least one approver. An item (event or task) can enter
 * one but not pass it -- forward, or by completing -- until that stage has an `approved`
 * approval in the current visit. Moving back to a stage or earlier supersedes the approvals
 * from there on (done by the repositories, in the same transaction as the move).
 */

/** Approver tokens: three specials, or a role name other than admin (the `admin` token IS the Admin). */
export const APPROVER_SPECIAL_TOKENS = ["admin", "team_managers", "client"] as const;
export const APPROVER_ROLE_TOKENS = ROLES.filter((r): r is Exclude<Role, "admin"> => r !== "admin");
export const APPROVER_TOKENS = [...APPROVER_SPECIAL_TOKENS, ...APPROVER_ROLE_TOKENS] as const;
export type ApproverToken = (typeof APPROVER_TOKENS)[number];
/** The DB check allows at most this many tokens per stage. */
export const APPROVERS_MAX = 8;
/** Notes, links and comments on an approval. */
export const APPROVAL_TEXT_MAX = 2000;

export const APPROVAL_STATUSES = ["pending", "approved", "changes_requested", "cancelled", "superseded"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type ApprovalSubject = "event" | "task";
export type ApprovalDecision = "approve" | "changes";

export function isApproverToken(value: string): value is ApproverToken {
  return (APPROVER_TOKENS as readonly string[]).includes(value);
}

/**
 * Template validation: every token known, no repeats, at most APPROVERS_MAX, and `client` only on an
 * event template (a task has no client portal to approve from). 400 STAGE_TEMPLATE_APPROVERS_INVALID.
 * Returns the tokens as typed.
 */
export function assertApproversValid(kind: "event" | "task", approvers: readonly string[]): ApproverToken[] {
  const invalid = (message: string) => new BadRequestError(message, ERROR_CODES.STAGE_TEMPLATE_APPROVERS_INVALID);
  if (approvers.length > APPROVERS_MAX) throw invalid(`At most ${APPROVERS_MAX} approvers per stage`);
  const seen = new Set<string>();
  for (const token of approvers) {
    if (!isApproverToken(token)) throw invalid(`"${token}" is not an approver`);
    if (seen.has(token)) throw invalid(`"${token}" appears twice`);
    seen.add(token);
    if (token === "client" && kind !== "event") throw invalid("Only an event template can have the client as an approver");
  }
  return approvers as ApproverToken[];
}

// -- the move gate ---------------------------------------------------------------

export interface GateStage {
  position: number;
  approvers: readonly string[];
  /** The stage holds an `approved` approval in the current visit. */
  approved: boolean;
  /**
   * Round 4: how many child events / tasks hanging on this stage are unfinished (ALL of them, whether or not the
   * caller can see them -- the gate must not be bypassable by what someone can't see). 0 = none.
   */
  openChildren: number;
}

/** The stage still waits for an approval (it has approvers and none approved it in this visit). */
function needsApproval(s: Pick<GateStage, "approvers" | "approved">): boolean {
  return s.approvers.length > 0 && !s.approved;
}

/**
 * The first stage at or after `currentPosition` that blocks: it needs an approval it hasn't got (round 3) or has
 * unfinished children (round 4). The item can be moved to it, not past it.
 */
export function blockingStage<T extends GateStage>(stages: readonly T[], currentPosition: number): T | null {
  let found: T | null = null;
  for (const s of stages) {
    if (s.position < currentPosition || (!needsApproval(s) && s.openChildren <= 0)) continue;
    if (found === null || s.position < found.position) found = s;
  }
  return found;
}

/** The position just past the last stage: where "complete" lands. */
export function completionPosition(stages: readonly { position: number }[]): number {
  return stages.reduce((max, s) => Math.max(max, s.position), 0) + 1;
}

/** The highest position the item may move to from `currentPosition`: it stops AT the first unapproved approval stage. */
export function maxReachablePosition(stages: readonly GateStage[], currentPosition: number): number {
  return blockingStage(stages, currentPosition)?.position ?? completionPosition(stages);
}

/**
 * A forward move (or completing, `targetPosition` = completionPosition) past a blocking stage is a 409 naming that
 * stage: STAGE_APPROVAL_REQUIRED when it still needs approval (also when it has unfinished children too -- the
 * approval error comes first), STAGE_CHILDREN_OPEN ("<stage> has N unfinished parts") when children are the only
 * reason. Moves back, and moves up to and onto the blocking stage, are free.
 */
export function assertCanPass(stages: readonly (GateStage & { name: string })[], currentPosition: number, targetPosition: number): void {
  if (targetPosition <= currentPosition) return;
  const blocker = blockingStage(stages, currentPosition);
  if (blocker && targetPosition > blocker.position) {
    if (needsApproval(blocker)) {
      throw new ConflictError(`"${blocker.name}" needs approval before this can move on`, ERROR_CODES.STAGE_APPROVAL_REQUIRED);
    }
    const n = blocker.openChildren;
    throw new ConflictError(`"${blocker.name}" has ${n} unfinished ${n === 1 ? "part" : "parts"}`, ERROR_CODES.STAGE_CHILDREN_OPEN);
  }
}

/**
 * The stages with their `approved` flag filled from the ids that hold an approved approval, and (round 4) their
 * `openChildren` from the per-stage counts (a stage missing from the map has none; stages that already carry
 * an `openChildren`, as a detail's do, keep it when no map is given).
 */
export function withApproved<T extends { id: string }>(
  stages: readonly T[],
  approvedStageIds: ReadonlySet<string>,
  openChildren?: ReadonlyMap<string, number>,
): (T & { approved: boolean; openChildren: number })[] {
  return stages.map((s) => ({
    ...s,
    approved: approvedStageIds.has(s.id),
    openChildren: openChildren ? (openChildren.get(s.id) ?? 0) : ((s as { openChildren?: number }).openChildren ?? 0),
  }));
}

/** Why a stage stops forward moves: it waits for an approval, or has unfinished children. */
export type BlockedReason = "approval" | "children";

/**
 * What the detail responses call `nextBlockedBy`: the stage that currently stops forward moves, or null.
 * `reason` is "approval" when it still needs one (even if it also has open children), else "children";
 * `openChildren` is that stage's unfinished-children count (0 for a pure approval stop).
 */
export function nextBlockedBy(
  stages: readonly { id: string; name: string; position: number; approvers: readonly string[]; openChildren?: number }[],
  approvedStageIds: ReadonlySet<string>,
  currentPosition: number,
  openChildren?: ReadonlyMap<string, number>,
): { stageId: string; stageName: string; stagePosition: number; reason: BlockedReason; openChildren: number } | null {
  const blocker = blockingStage(withApproved(stages, approvedStageIds, openChildren), currentPosition);
  if (!blocker) return null;
  return {
    stageId: blocker.id,
    stageName: blocker.name,
    stagePosition: blocker.position,
    reason: needsApproval(blocker) ? "approval" : "children",
    openChildren: blocker.openChildren,
  };
}

// -- who may decide ----------------------------------------------------------------

export interface ApprovalCaller {
  userId: string;
  role: Role;
}

export interface ApproverContext {
  /** The item's client's team (profile ids); [] for a task without a client. */
  teamIds: readonly string[];
}

/**
 * Does the caller match one of the stage's tokens? `admin` and role tokens are the caller's role;
 * `team_managers` is a client-manager role on the item's client team; `client` is never a staff member.
 */
export function matchesApprover(caller: ApprovalCaller, approvers: readonly string[], ctx: ApproverContext): boolean {
  return approvers.some((token) => {
    if (token === "client") return false;
    if (token === "team_managers") return isClientManager(caller.role) && ctx.teamIds.includes(caller.userId);
    return token === caller.role;
  });
}

export interface DecideContext extends ApproverContext {
  /** The caller can see the item under the existing visibility rules. */
  canSeeItem: boolean;
  /** Who asked for approval (null if that account is gone). */
  requestedBy: string | null;
}

/** Why a visible item's approval can't be decided by this caller; null = may decide. (Self-approval: the Admin is exempt.) */
export function decisionRefusal(caller: ApprovalCaller, approvers: readonly string[], ctx: DecideContext): "not_approver" | "self" | null {
  if (!matchesApprover(caller, approvers, ctx)) return "not_approver";
  if (ctx.requestedBy !== null && ctx.requestedBy === caller.userId && caller.role !== "admin") return "self";
  return null;
}

/** May this caller decide? They must see the item, match a token, and not be deciding their own request (Admin excepted). */
export function canDecide(caller: ApprovalCaller, approvers: readonly string[], ctx: DecideContext): boolean {
  return ctx.canSeeItem && decisionRefusal(caller, approvers, ctx) === null;
}

/** The refusal as an error: 403 STAGE_APPROVAL_NOT_APPROVER / STAGE_APPROVAL_SELF. */
export function assertCanDecide(caller: ApprovalCaller, approvers: readonly string[], ctx: DecideContext): void {
  const refusal = decisionRefusal(caller, approvers, ctx);
  if (refusal === "not_approver") {
    throw new ForbiddenError("You are not one of the approvers for this stage", ERROR_CODES.STAGE_APPROVAL_NOT_APPROVER);
  }
  if (refusal === "self") {
    throw new ForbiddenError("You can't decide your own request", ERROR_CODES.STAGE_APPROVAL_SELF);
  }
}

/** Requesting changes needs a comment (400 STAGE_APPROVAL_COMMENT_REQUIRED). Returns the trimmed comment or null. */
export function assertDecisionComment(decision: ApprovalDecision, comment: string | null | undefined): string | null {
  const text = comment?.trim() ? comment.trim() : null;
  if (decision === "changes" && text === null) {
    throw new BadRequestError("Say what needs to change", ERROR_CODES.STAGE_APPROVAL_COMMENT_REQUIRED);
  }
  return text;
}

/** Withdrawing a request: whoever asked for it, or whoever manages the item. */
export function canCancelApproval(caller: ApprovalCaller, requestedBy: string | null, canManageItem: boolean): boolean {
  return canManageItem || (requestedBy !== null && requestedBy === caller.userId);
}

// -- who can see / move / manage the item -------------------------------------------

/** What the visibility rules need about the item an approval is on. */
export interface ApprovalItemRef {
  subject: ApprovalSubject;
  /** The item's client's team (profile ids); [] for a task without a client. */
  teamIds: readonly string[];
  /** Tasks only. */
  assigneeId?: string | null;
  assignedBy?: string | null;
}

/**
 * The existing visibility rules, restated for the approvals module (ADR 0003: no cross-module
 * imports): the Admin sees everything; an event is seen by managers on its client's team; a task by its
 * assignee, its creator, and -- client-manager roles -- its client's team.
 */
export function canSeeApprovalItem(caller: ApprovalCaller, item: ApprovalItemRef): boolean {
  if (caller.role === "admin") return true;
  const onTeam = isClientManager(caller.role) && item.teamIds.includes(caller.userId);
  if (item.subject === "event") return onTeam;
  return item.assigneeId === caller.userId || item.assignedBy === caller.userId || onTeam;
}

/** Who may move the item through its stages (and so ask for approval): events = whoever sees them; tasks = assignee, creator, Admin. */
export function canMoveApprovalItem(caller: ApprovalCaller, item: ApprovalItemRef): boolean {
  if (caller.role === "admin") return true;
  if (item.subject === "event") return canSeeApprovalItem(caller, item) && hasCapability(caller.role, "events:write");
  return item.assigneeId === caller.userId || item.assignedBy === caller.userId;
}

/** Who manages the item (may cancel anyone's request): the Admin; a manager on the event's team; the task's creator while they can still assign. */
export function canManageApprovalItem(caller: ApprovalCaller, item: ApprovalItemRef): boolean {
  if (caller.role === "admin") return true;
  if (item.subject === "event") return canSeeApprovalItem(caller, item) && hasCapability(caller.role, "events:write");
  return item.assignedBy === caller.userId && hasCapability(caller.role, "staff_tasks:assign");
}

// -- the shapes that cross modules ----------------------------------------------------

/** One approval round as stored, with names and its stage resolved (the response without the caller's flags). */
export interface ApprovalRecord {
  id: string;
  subject: ApprovalSubject;
  subjectId: string;
  subjectTitle: string;
  clientName: string | null;
  stageId: string;
  stageName: string;
  stagePosition: number;
  approvers: ApproverToken[];
  status: ApprovalStatus;
  requestNote: string | null;
  requestLink: string | null;
  requestedById: string | null;
  requestedByName: string | null;
  requestedAt: string;
  decidedById: string | null;
  decidedByName: string | null;
  decidedVia: "staff" | "portal" | null;
  decidedAt: string | null;
  decisionComment: string | null;
  version: number;
}

/** The API's Approval: the record plus what *this caller* may do (so the web needs no role logic). */
export interface Approval extends ApprovalRecord {
  canDecide: boolean;
  canCancel: boolean;
}

/** Adds the caller's flags. Only a pending request can be decided or cancelled. `canManageItem`: Admin, the task's creator, or a manager on the event's team. */
export function toApproval(
  record: ApprovalRecord,
  caller: ApprovalCaller,
  ctx: { teamIds: readonly string[]; canSeeItem: boolean; canManageItem: boolean },
): Approval {
  const pending = record.status === "pending";
  return {
    ...record,
    canDecide: pending && canDecide(caller, record.approvers, { teamIds: ctx.teamIds, canSeeItem: ctx.canSeeItem, requestedBy: record.requestedById }),
    canCancel: pending && ctx.canSeeItem && canCancelApproval(caller, record.requestedById, ctx.canManageItem),
  };
}

/** Stage ids that currently hold an approved approval. */
export function approvedStageIds(records: readonly Pick<ApprovalRecord, "stageId" | "status">[]): Set<string> {
  return new Set(records.filter((r) => r.status === "approved").map((r) => r.stageId));
}

/** An approval record plus the item facts the caller's flags are worked out from (what a list query returns per row). */
export interface ApprovalRow {
  record: ApprovalRecord;
  /** The item's client's team. */
  teamIds: string[];
  /** Tasks only. */
  assigneeId: string | null;
  assignedBy: string | null;
}

/** A listed row for a caller who is already known to see the item (the list queries only return visible ones). */
export function approvalFromRow(row: ApprovalRow, caller: ApprovalCaller): Approval {
  const item: ApprovalItemRef = { subject: row.record.subject, teamIds: row.teamIds, assigneeId: row.assigneeId, assignedBy: row.assignedBy };
  return toApproval(row.record, caller, { teamIds: row.teamIds, canSeeItem: true, canManageItem: canManageApprovalItem(caller, item) });
}
