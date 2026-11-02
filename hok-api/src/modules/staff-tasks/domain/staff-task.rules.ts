import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { canAssignTo, hasCapability, roleLevel, type Role } from "../../../domain";
import type { EditorFields, StaffTaskStatus } from "./staff-task.entity";

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

/** Status changes: the assignee, or the Admin. */
export function assertCanChangeStatus(caller: TaskCaller, task: { assigneeId: string }): void {
  if (roleLevel(caller.role) !== 1 && task.assigneeId !== caller.userId) {
    throw new ForbiddenError("Only the assignee or the Admin can change this task's status", ERROR_CODES.STAFF_TASK_FORBIDDEN);
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
 * FR-TSK-10: the editor brief (raw files link, reference link, script) belongs
 * to **editor** tasks. Since 2026-11-02 none of the three is required (round 2
 * replaces them with plain links). For any other role the three fields stay
 * empty:
 *
 * - sending a non-empty editor field for a non-editor is refused (400), so the
 *   form never stores something nobody will see;
 * - reassigning a task from an editor to someone else clears the stored ones
 *   (they were the editor's brief), which the UI warns about first.
 *
 * `merged` = the stored values overlaid with this request's; `sent` = only
 * what this request carried.
 */
export function resolveEditorFields(assigneeRole: Role, merged: EditorFields, sent: Partial<EditorFields>): EditorFields {
  if (assigneeRole === "editor") return merged;
  if (sent.rawFilesUrl || sent.referenceUrl || sent.script) {
    throw new BadRequestError(
      "Raw files link, reference link and script are only for tasks assigned to an Editor",
      ERROR_CODES.STAFF_TASK_EDITOR_FIELDS_INVALID,
    );
  }
  return { rawFilesUrl: null, referenceUrl: null, script: null };
}

/**
 * FR-TSK-03/04: the assignee (or the Admin) moves an open task to any other
 * status -- todo, in_progress, blocked, done. A done task is closed: only the
 * Admin reopens it, through its own action (FR-TSK-05).
 */
export function assertStatusChange(current: StaffTaskStatus, target: StaffTaskStatus): void {
  if (current === "done") {
    throw new ConflictError("This task is done. Only the Admin can reopen it.", ERROR_CODES.STAFF_TASK_DONE);
  }
  if (current === target) {
    throw new ConflictError("The task already has this status", ERROR_CODES.STAFF_TASK_STATUS_UNCHANGED);
  }
}

/** FR-TSK-05: only a done task can be reopened. */
export function assertReopenable(current: StaffTaskStatus): void {
  if (current !== "done") {
    throw new ConflictError("Only a done task can be reopened", ERROR_CODES.STAFF_TASK_NOT_DONE);
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
