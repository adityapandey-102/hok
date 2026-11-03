import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { canAssignTo, hasCapability, roleLevel, type Role } from "../../../domain";
import { TASK_LINKS_MAX, type StaffTaskStatus, type TaskLinkKind, type TaskStage } from "./staff-task.entity";

/**
 * Business rules for staff tasks (REQUIREMENTS §5.9). Pure functions; the
 * service runs the ones that must hold under concurrency inside the
 * repository's transaction, against the locked row (guard callback).
 */

/**
 * Which tasks a caller may see: all (Admin), or the ones assigned to them, the
 * ones they created, and -- `viaTeam`, client-manager roles only -- the ones
 * linked to a client whose team they're on. A person moved to a task-only role
 * keeps no team visibility even if still listed on a team.
 */
export type StaffTaskScope = { kind: "all" } | { kind: "own"; userId: string; viaTeam: boolean };

/** The signed-in person a rule is applied to. */
export interface TaskCaller {
  userId: string;
  role: Role;
}

/** What visibility needs from a task row. `teamIds` = the linked client's team ([] without a client). */
export interface TaskVisibilityFields {
  assigneeId: string;
  assignedBy: string | null;
  teamIds: string[];
}

/** The task template a new task starts from (read from the stage templates, Infrastructure-to-Infrastructure). */
export interface TaskTemplate {
  id: string;
  name: string;
  active: boolean;
  kind: "event" | "task";
  /** The assignee roles it is offered for; empty = any role. */
  roles: Role[];
  stageNames: string[];
}

/** A would-be assignee as stored. */
export interface AssigneeCandidate {
  id: string;
  role: Role;
  active: boolean;
}

/** The client a task would be linked to, with its team (for the manager's "my clients only" rule). */
export interface TaskClientRef {
  id: string;
  teamIds: string[];
}

/** The event a task would be linked to, with the client it belongs to. */
export interface TaskEventRef {
  id: string;
  clientId: string;
  title: string;
  /** The event's client's team. */
  teamIds: string[];
}

/** True if the scope lets the caller see this task (assignee, creator, or -- managers -- the client's team). */
export function isTaskVisible(scope: StaffTaskScope, task: TaskVisibilityFields): boolean {
  if (scope.kind === "all") return true;
  return (
    task.assigneeId === scope.userId ||
    task.assignedBy === scope.userId ||
    (scope.viaTeam && task.teamIds.includes(scope.userId))
  );
}

/**
 * The task, if the caller may see it. One that isn't visible is a 404, never
 * a 403 -- the same answer as a missing id, so existence never leaks (the
 * clients pattern).
 */
export function assertTaskVisible<T extends TaskVisibilityFields>(scope: StaffTaskScope, task: T | null): T {
  if (!task || !isTaskVisible(scope, task)) {
    throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
  }
  return task;
}

/**
 * Edit, reassign, reopen and delete: the Admin, or the task's creator while
 * they still hold staff_tasks:assign. (Decision 2026-11-02.)
 */
export function canManageTask(caller: TaskCaller, task: { assignedBy: string | null }): boolean {
  if (roleLevel(caller.role) === 1) return true;
  return task.assignedBy === caller.userId && hasCapability(caller.role, "staff_tasks:assign");
}

/** A visible task the caller may not write to (a team manager who is neither creator nor assignee) is a 403, not a 404. */
export function assertCanManage(caller: TaskCaller, task: { assignedBy: string | null }): void {
  if (!canManageTask(caller, task)) {
    throw new ForbiddenError("Only the Admin or the person who created this task can change it", ERROR_CODES.STAFF_TASK_FORBIDDEN);
  }
}

/** Moving through the stages, completing and unblocking: the assignee, the creator or the Admin. */
export function assertCanMoveStage(caller: TaskCaller, task: { assigneeId: string; assignedBy: string | null }): void {
  if (roleLevel(caller.role) !== 1 && task.assigneeId !== caller.userId && task.assignedBy !== caller.userId) {
    throw new ForbiddenError("Only the assignee, the creator or the Admin can move this task", ERROR_CODES.STAFF_TASK_FORBIDDEN);
  }
}

/** Raising the blocked flag: the assignee (who knows what is in the way) or the Admin. */
export function assertCanBlock(caller: TaskCaller, task: { assigneeId: string }): void {
  if (roleLevel(caller.role) !== 1 && task.assigneeId !== caller.userId) {
    throw new ForbiddenError("Only the assignee or the Admin can mark this task as blocked", ERROR_CODES.STAFF_TASK_FORBIDDEN);
  }
}

/** Comments: the assignee, the creator, or the Admin. */
export function assertCanComment(caller: TaskCaller, task: { assigneeId: string; assignedBy: string | null }): void {
  if (roleLevel(caller.role) !== 1 && task.assigneeId !== caller.userId && task.assignedBy !== caller.userId) {
    throw new ForbiddenError("Only the assignee, the creator or the Admin can comment on this task", ERROR_CODES.STAFF_TASK_FORBIDDEN);
  }
}

/**
 * The assignment ladder (decision 2026-11-02), checked against the **caller's**
 * role: strictly downwards, so an Admin can't assign to an Admin or to
 * themselves, and a manager only to task-only roles.
 */
export function assertCanAssign(callerRole: Role, assigneeRole: Role): void {
  if (!canAssignTo(callerRole, assigneeRole)) {
    throw new BadRequestError("You can only assign tasks to roles below yours", ERROR_CODES.STAFF_TASK_ASSIGNEE_NOT_ALLOWED);
  }
}

/**
 * A client manager (level 2) may link only a client whose team they're on, or
 * an event of such a client; anything else is the same 400 as "no such client",
 * so existence never leaks. The Admin links anything. Returns the refs to feed
 * `resolveTaskLinks` (a client off the manager's teams is masked to null).
 */
export function restrictLinksToTeam(
  caller: TaskCaller,
  client: TaskClientRef | null,
  event: TaskEventRef | null,
): { client: TaskClientRef | null; event: TaskEventRef | null } {
  if (roleLevel(caller.role) === 1) return { client, event };
  if (event && !event.teamIds.includes(caller.userId)) {
    throw new BadRequestError("No such client", ERROR_CODES.STAFF_TASK_CLIENT_INVALID);
  }
  return { client: client && client.teamIds.includes(caller.userId) ? client : null, event };
}

/** Optimistic lock. `undefined` = the caller sent no version (only where documented). */
export function assertTaskVersion(current: number, expected: number | undefined): void {
  if (expected !== undefined && current !== expected) {
    throw new ConflictError("This task was changed by someone else. Reload and try again.", ERROR_CODES.STAFF_TASK_MODIFIED);
  }
}

/** FR-TSK-01: exactly one assignee, any role, but an active account. */
export function assertValidAssignee(candidate: AssigneeCandidate | null): AssigneeCandidate {
  if (!candidate || !candidate.active) {
    throw new BadRequestError("A task can only be assigned to an active staff member", ERROR_CODES.STAFF_TASK_ASSIGNEE_INVALID);
  }
  return candidate;
}

/**
 * Only an existing, ACTIVE **task** template with stages can start a task, and
 * only for an assignee whose role it is offered for (an empty role list = any
 * role). Reassigning later is free: the stages are already snapshotted.
 */
export function assertTaskTemplateUsable(template: TaskTemplate | null, assigneeRole: Role): TaskTemplate {
  if (
    !template ||
    template.kind !== "task" ||
    !template.active ||
    template.stageNames.length === 0 ||
    (template.roles.length > 0 && !template.roles.includes(assigneeRole))
  ) {
    throw new BadRequestError("Pick an active task template offered for the assignee's role", ERROR_CODES.STAFF_TASK_TEMPLATE_INVALID);
  }
  return template;
}

// -- stages and the status they imply ------------------------------------------

/**
 * The status a task has when it sits at stage `position` of `stageCount` and the
 * blocked flag is down: stage 1 = todo, stages 2..N = in_progress, past the last
 * stage = done. (The blocked flag is separate: it sets "blocked" and leaves the stage.)
 */
export function statusForStage(position: number, stageCount: number): StaffTaskStatus {
  if (position > stageCount) return "done";
  return position <= 1 ? "todo" : "in_progress";
}

/**
 * Stage moves, mirroring an event's: a task can go to ANY of its stages, forward
 * or back (work really does go back, and a wrong click must be undoable; the
 * timeline keeps every move). Refused:
 *  - a done task (409 STAFF_TASK_DONE) -- a manager reopens it first;
 *  - a stage of another task (400 STAFF_TASK_STAGE_INVALID);
 *  - the stage it's already at (409 STAFF_TASK_STAGE_UNCHANGED).
 */
export function assertStageMove(input: { status: StaffTaskStatus; currentStageId: string; stages: readonly TaskStage[]; targetStageId: string }): TaskStage {
  assertNotDone(input.status);
  const target = findStage(input.stages, input.targetStageId);
  if (target.id === input.currentStageId) {
    throw new ConflictError("The task is already at this stage", ERROR_CODES.STAFF_TASK_STAGE_UNCHANGED);
  }
  return target;
}

/** "Mark complete" is the move past the last stage, so it is only offered from there (409 STAFF_TASK_NOT_AT_LAST_STAGE). */
export function assertCanComplete(task: { status: StaffTaskStatus; currentStagePosition: number; stageCount: number }): void {
  assertNotDone(task.status);
  if (task.currentStagePosition !== task.stageCount) {
    throw new ConflictError("A task can only be completed from its last stage", ERROR_CODES.STAFF_TASK_NOT_AT_LAST_STAGE);
  }
}

/** Blocking: not a done task (409 STAFF_TASK_DONE), not one already blocked (409 STAFF_TASK_ALREADY_BLOCKED). */
export function assertCanRaiseBlock(status: StaffTaskStatus): void {
  assertNotDone(status);
  if (status === "blocked") {
    throw new ConflictError("This task is already blocked", ERROR_CODES.STAFF_TASK_ALREADY_BLOCKED);
  }
}

/** Unblocking only makes sense for a blocked task (409 STAFF_TASK_NOT_BLOCKED). */
export function assertBlocked(status: StaffTaskStatus): void {
  if (status !== "blocked") {
    throw new ConflictError("This task isn't blocked", ERROR_CODES.STAFF_TASK_NOT_BLOCKED);
  }
}

/** FR-TSK-05: only a done task can be reopened. */
export function assertReopenable(current: StaffTaskStatus): void {
  if (current !== "done") {
    throw new ConflictError("Only a done task can be reopened", ERROR_CODES.STAFF_TASK_NOT_DONE);
  }
}

/** The stage a reopen goes to: the one named, else the last. A stage of another task is a 400. */
export function reopenTarget(stages: readonly TaskStage[], stageId: string | undefined): TaskStage {
  if (stageId !== undefined) return findStage(stages, stageId);
  const last = stages.reduce<TaskStage | null>((a, s) => (a === null || s.position > a.position ? s : a), null);
  if (!last) throw new BadRequestError("That stage doesn't belong to this task", ERROR_CODES.STAFF_TASK_STAGE_INVALID);
  return last;
}

/** A stage must be one of the task's own (400 STAFF_TASK_STAGE_INVALID). */
export function findStage(stages: readonly TaskStage[], stageId: string): TaskStage {
  const stage = stages.find((s) => s.id === stageId);
  if (!stage) throw new BadRequestError("That stage doesn't belong to this task", ERROR_CODES.STAFF_TASK_STAGE_INVALID);
  return stage;
}

function assertNotDone(status: StaffTaskStatus): void {
  if (status === "done") {
    throw new ConflictError("This task is done. A manager can reopen it.", ERROR_CODES.STAFF_TASK_DONE);
  }
}

// -- links ---------------------------------------------------------------------

/**
 * Adding a link: "brief" links (the inputs) by whoever may manage the task; "delivered"
 * links (the finished work) by the assignee or the Admin.
 */
export function assertCanAddLink(caller: TaskCaller, task: { assigneeId: string; assignedBy: string | null }, kind: TaskLinkKind): void {
  const allowed = kind === "brief" ? canManageTask(caller, task) : roleLevel(caller.role) === 1 || task.assigneeId === caller.userId;
  if (!allowed) {
    throw new ForbiddenError(
      kind === "brief" ? "Only the Admin or the person who created this task can add brief links" : "Only the assignee or the Admin can add delivered links",
      ERROR_CODES.STAFF_TASK_FORBIDDEN,
    );
  }
}

/** Removing a link: whoever added it, or whoever may manage the task. */
export function assertCanRemoveLink(caller: TaskCaller, task: { assignedBy: string | null }, link: { addedById: string | null }): void {
  if (link.addedById !== caller.userId && !canManageTask(caller, task)) {
    throw new ForbiddenError("Only the person who added this link, the Admin or the task's creator can remove it", ERROR_CODES.STAFF_TASK_FORBIDDEN);
  }
}

/** A task holds at most TASK_LINKS_MAX links (409 STAFF_TASK_LINKS_LIMIT). */
export function assertLinksRoom(existing: number, adding = 1): void {
  if (existing + adding > TASK_LINKS_MAX) {
    throw new ConflictError(`A task can hold at most ${TASK_LINKS_MAX} links`, ERROR_CODES.STAFF_TASK_LINKS_LIMIT);
  }
}

/**
 * Sharing a delivered link with the client writes an asset on the task's event's
 * client, so it needs what writing assets needs: the Admin, or a client manager on
 * that client's team. (Task-only roles, editors included, can't; their manager does.)
 * `teamIds` = the event's client's team.
 */
export function canShareWithClient(caller: TaskCaller, task: { eventId: string | null; teamIds: readonly string[] }): boolean {
  if (!task.eventId) return false;
  if (roleLevel(caller.role) === 1) return true;
  return hasCapability(caller.role, "assets:write") && task.teamIds.includes(caller.userId);
}

/**
 * The share checks in the order the API reports them: a role that can't write assets at all
 * is a 403; then a task without an event is a 409 STAFF_TASK_NO_EVENT; then a manager who isn't on
 * the event's client's team is a 403. (Run again on the locked rows inside the transaction.)
 */
export function assertCanShare(caller: TaskCaller, task: { eventId: string | null; teamIds: readonly string[] }): void {
  const forbidden = () => new ForbiddenError("Only the Admin or a manager on this client's team can share work with the client", ERROR_CODES.STAFF_TASK_FORBIDDEN);
  if (roleLevel(caller.role) !== 1 && !hasCapability(caller.role, "assets:write")) throw forbidden();
  if (!task.eventId) {
    throw new ConflictError("Link this task to an event before sharing work with the client", ERROR_CODES.STAFF_TASK_NO_EVENT);
  }
  if (!canShareWithClient(caller, task)) throw forbidden();
}

/** A delivered link that hasn't been shared yet (a brief link, or a missing one, is a 404; already shared is a 409). */
export function assertShareable(link: { kind: TaskLinkKind; sharedAssetId: string | null } | null): void {
  if (!link || link.kind !== "delivered") {
    throw new NotFoundError("Delivered link not found", ERROR_CODES.STAFF_TASK_LINK_NOT_FOUND);
  }
  if (link.sharedAssetId) {
    throw new ConflictError("This link was already shared with the client", ERROR_CODES.STAFF_TASK_LINK_ALREADY_SHARED);
  }
}

/**
 * The client a task ends up linked to, given an optional client and event.
 * The event must exist and, when a client is named too, belong to it; an
 * event alone links its own client.
 */
export function resolveTaskLinks(
  clientId: string | null,
  client: TaskClientRef | null,
  eventId: string | null,
  event: TaskEventRef | null,
): { clientId: string | null; eventId: string | null } {
  if (clientId && !client) {
    throw new BadRequestError("No such client", ERROR_CODES.STAFF_TASK_CLIENT_INVALID);
  }
  if (!eventId) return { clientId, eventId: null };
  if (!event || (clientId && event.clientId !== clientId)) {
    throw new BadRequestError("No such event for this client", ERROR_CODES.STAFF_TASK_EVENT_INVALID);
  }
  return { clientId: event.clientId, eventId };
}

/** Overdue = past its due instant and not done. */
export function isOverdue(task: { dueAt: string | null; status: StaffTaskStatus }, now: Date = new Date()): boolean {
  return task.status !== "done" && task.dueAt !== null && new Date(task.dueAt).getTime() < now.getTime();
}
