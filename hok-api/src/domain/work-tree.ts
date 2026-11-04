import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../common/errors/app-error";
import { ERROR_CODES } from "../common/errors/error-codes";
import { canMoveApprovalItem, canSeeApprovalItem, type ApprovalCaller } from "./stage-approvals";

/**
 * Parent and child work (round 4): the pure rules, in the shared kernel because events, staff tasks and the
 * approvals module all need them (ADR 0003: an Application layer never imports another module's).
 *
 * From any stage of an event or a task, someone who may move that item can create a CHILD event or task tied to
 * that stage. While a stage has UNFINISHED children the parent can't pass it (the move gate in stage-approvals.ts,
 * `GateStage.openChildren`). Nesting is at most 3 levels. A child is FINISHED when
 *  - a task: its status is `done`;
 *  - an event: it is active, sits on its last stage and that stage, if it needs approval, is approved.
 * A cancelled event and a deleted task don't block. A postponed event does (it is not finished).
 */

export type WorkKind = "event" | "task";

/** At most parent -> child -> grandchild. */
export const WORK_MAX_DEPTH = 3;

/** A child's pointer to its parent: the parent item and the stage of it the child hangs on. */
export interface ParentRef {
  kind: WorkKind;
  id: string;
  stageId: string;
}

// -- finished / open ----------------------------------------------------------------

export function isFinishedTask(task: { status: string }): boolean {
  return task.status === "done";
}

/**
 * Finished = active AND on the last stage AND (that stage needs no approval, or is approved).
 * A postponed event is never finished (stricter on purpose: the parent keeps waiting); a cancelled one isn't
 * finished either, but it doesn't block (see `isOpenEvent`).
 */
export function isFinishedEvent(event: {
  state: string;
  currentPosition: number;
  stageCount: number;
  lastStageNeedsApproval: boolean;
  lastStageApproved: boolean;
}): boolean {
  return event.state === "active" && event.currentPosition >= event.stageCount && (!event.lastStageNeedsApproval || event.lastStageApproved);
}

/** Unfinished work that blocks its parent's stage: a task not done. */
export function isOpenTask(task: { status: string }): boolean {
  return !isFinishedTask(task);
}

/** Unfinished work that blocks its parent's stage: an event that isn't cancelled and isn't finished. */
export function isOpenEvent(event: Parameters<typeof isFinishedEvent>[0]): boolean {
  return event.state !== "cancelled" && !isFinishedEvent(event);
}

// -- creating a child -----------------------------------------------------------------

/** Creating a child of an item that is already at the deepest level is 409 WORK_TOO_DEEP. */
export function assertDepth(parentDepth: number): void {
  if (parentDepth >= WORK_MAX_DEPTH) {
    throw new ConflictError(`Parts can only go ${WORK_MAX_DEPTH} levels deep`, ERROR_CODES.WORK_TOO_DEEP);
  }
}

/** What the child rules need to know about the parent, read under FOR SHARE in the creating transaction. */
export interface ParentFacts {
  kind: WorkKind;
  id: string;
  title: string;
  /** 1 for a top-level item. */
  depth: number;
  /** An event: active | cancelled | postponed. A task: its status. */
  state: string;
  /** The parent's client; null for a task without one. */
  clientId: string | null;
  clientStatus: "active" | "paused" | "archived" | null;
  /** The parent's client's team; [] without a client. */
  teamIds: string[];
  /** Tasks only. */
  assigneeId: string | null;
  assignedBy: string | null;
  /** The ids of the parent's stages. */
  stageIds: string[];
  /** The parent's own parent (a child of a child), if any. */
  parent: ParentRef | null;
}

/** The facts as the approvals/visibility rules want them. */
function itemRef(parent: ParentFacts) {
  return { subject: parent.kind, teamIds: parent.teamIds, assigneeId: parent.assigneeId, assignedBy: parent.assignedBy };
}

/**
 * May this caller add a child to `stageId` of `parent`? In the order the refusals are decided:
 *  1. a parent that doesn't exist or the caller can't see: 404 (the same as any read -- nothing leaks);
 *  2. the caller can't MOVE the parent (events: Admin or a manager on the team; tasks: assignee, creator, Admin): 403;
 *  3. an event parent that isn't active (409 EVENT_NOT_ACTIVE; stricter than "cancelled": a postponed event can't
 *     move stages either), a done task (409 STAFF_TASK_DONE);
 *  4. an event parent whose client is archived (409 CLIENT_ARCHIVED);
 *  5. a stage that isn't one of the parent's (400 WORK_PARENT_STAGE_INVALID);
 *  6. a parent already 3 levels deep (409 WORK_TOO_DEEP).
 * The caller's own create rights (events:write, the assign ladder...) are checked by the create path, not here.
 */
export function assertCanAddChild(caller: ApprovalCaller, kind: WorkKind, parent: ParentFacts | null, stageId: string): ParentFacts {
  if (!parent || !canSeeApprovalItem(caller, itemRef(parent))) {
    if (kind === "task") throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
    throw new NotFoundError("Event not found", ERROR_CODES.EVENT_NOT_FOUND);
  }
  if (!canMoveApprovalItem(caller, itemRef(parent))) {
    throw new ForbiddenError("You can't add parts to this item", parent.kind === "task" ? ERROR_CODES.STAFF_TASK_FORBIDDEN : ERROR_CODES.FORBIDDEN);
  }
  if (parent.kind === "event") {
    if (parent.state !== "active") {
      throw new ConflictError("Only an active event can have parts added. Set it back to active first.", ERROR_CODES.EVENT_NOT_ACTIVE);
    }
    if (parent.clientStatus === "archived") {
      throw new ConflictError("This client is archived, so its events are read-only. Unarchive the client first.", ERROR_CODES.CLIENT_ARCHIVED);
    }
  } else if (parent.state === "done") {
    throw new ConflictError("This task is already done", ERROR_CODES.STAFF_TASK_DONE);
  }
  if (!parent.stageIds.includes(stageId)) {
    throw new BadRequestError("That stage doesn't belong to the parent", ERROR_CODES.WORK_PARENT_STAGE_INVALID);
  }
  assertDepth(parent.depth);
  return parent;
}

/**
 * A child event takes its parent's client: an event's own, or the task's. A task without a client can't have child
 * events (400 WORK_CHILD_EVENT_NEEDS_CLIENT); a different `clientId` in the body is 400 WORK_CHILD_CLIENT_MISMATCH.
 */
export function childEventClientId(parent: Pick<ParentFacts, "clientId">, bodyClientId: string): string {
  if (!parent.clientId) {
    throw new BadRequestError("This task has no client, so it can't have child events", ERROR_CODES.WORK_CHILD_EVENT_NEEDS_CLIENT);
  }
  if (bodyClientId !== parent.clientId) {
    throw new BadRequestError("A child event belongs to its parent's client", ERROR_CODES.WORK_CHILD_CLIENT_MISMATCH);
  }
  return parent.clientId;
}

// -- what a detail shows --------------------------------------------------------------

/** A detail's `parent`: only ever built for a caller who can see the parent. */
export interface WorkParent {
  kind: WorkKind;
  id: string;
  title: string;
  stageId: string;
  stageName: string;
}

/** A child's parent as the repositories read it: the stub plus what visibility needs. Never in a response. */
export interface WorkParentRecord extends WorkParent {
  teamIds: string[];
  assigneeId: string | null;
  assignedBy: string | null;
}

/**
 * The detail's `parent`: the stub if the caller may see the parent, else null -- a parent you can't see is
 * indistinguishable from no parent, so nothing about it (not even that it exists) leaks.
 */
export function visibleParent(caller: ApprovalCaller, record: WorkParentRecord | null): WorkParent | null {
  if (!record || !canSeeApprovalItem(caller, { subject: record.kind, teamIds: record.teamIds, assigneeId: record.assigneeId, assignedBy: record.assignedBy })) {
    return null;
  }
  return { kind: record.kind, id: record.id, title: record.title, stageId: record.stageId, stageName: record.stageName };
}

/** One child as a detail lists it (only children the caller can see). */
export interface WorkChild {
  kind: WorkKind;
  id: string;
  title: string;
  /** The parent's stage it hangs on. */
  stageId: string;
  stageName: string;
  currentStageName: string;
  currentPosition: number;
  stageCount: number;
  /** Tasks only. */
  status: string | null;
  /** Events only. */
  state: string | null;
  /** Done (task) / on its last stage and approved if needed (event). A cancelled event is not finished -- but doesn't block. */
  finished: boolean;
  /** Tasks only. */
  assigneeName: string | null;
}

/** A child row as the repositories read it: the shape of a WorkChild plus what visibility and ordering need. Never in a response. */
export interface WorkChildRow extends WorkChild {
  stagePosition: number;
  createdAt: string;
  /** The child's client's team (both kinds), and for tasks who it's assigned to and by whom. */
  teamIds: string[];
  assigneeId: string | null;
  assignedBy: string | null;
}

/** The most children a detail lists per kind (the gate counts all of them regardless). */
export const CHILDREN_LIST_MAX = 200;

/**
 * The children a caller may see (the existing visibility rules, per kind) in parent-stage order, and how many
 * of the parent's children they don't see -- counted, never described. `total` = every child of the parent,
 * of both kinds, as the database counted them (so a list cut at CHILDREN_LIST_MAX shows the rest as hidden).
 */
export function visibleChildren(
  caller: ApprovalCaller,
  rows: readonly WorkChildRow[],
  total: number,
): { children: WorkChild[]; hiddenChildren: number } {
  const seen = rows
    .filter((r) => canSeeApprovalItem(caller, { subject: r.kind, teamIds: r.teamIds, assigneeId: r.assigneeId, assignedBy: r.assignedBy }))
    .sort((a, b) => a.stagePosition - b.stagePosition || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const children = seen.map(({ stagePosition: _p, createdAt: _c, teamIds: _t, assigneeId: _a, assignedBy: _b, ...child }) => child);
  return { children, hiddenChildren: Math.max(0, total - children.length) };
}

// -- the hook for "the last unfinished child just finished" ----------------------------------

/**
 * After a child's change has committed, may its parent's stage now be clear? Implemented once (work-tree module)
 * and handed to the events, staff-tasks and approvals services as a port. Best-effort: it never throws and a
 * failure never fails the child's change. It notifies the parent's movers only when the stage really has no
 * unfinished child left.
 */
export interface WorkTreeNotifier {
  /** The child's parent is known (an entity read under the lock, or a deleted row). */
  stageMayBeClear(parent: ParentRef, actorId: string | null): Promise<void>;
  /** Only the child's id is known (an approval decision); looks its parent up first. A no-op for a top-level item. */
  childChanged(kind: WorkKind, childId: string, actorId: string | null): Promise<void>;
}

export const noopWorkTreeNotifier: WorkTreeNotifier = {
  stageMayBeClear: () => Promise.resolve(),
  childChanged: () => Promise.resolve(),
};
