import { BadRequestError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import type { Role } from "../../../domain";
import type { EditorFields, StaffTaskStatus } from "./staff-task.entity";

/**
 * Business rules for staff tasks (REQUIREMENTS §5.9). Pure functions; the
 * service runs the ones that must hold under concurrency inside the
 * repository's transaction, against the locked row (guard callback).
 */

/** Which tasks a caller may see and work on: all (Admin) or only those assigned to them. */
export type StaffTaskScope = { kind: "all" } | { kind: "own"; userId: string };

/** A would-be assignee as stored. */
export interface AssigneeCandidate {
  id: string;
  role: Role;
  active: boolean;
}

/** The client a task would be linked to. */
export interface TaskClientRef {
  id: string;
}

/** The event a task would be linked to, with the client it belongs to. */
export interface TaskEventRef {
  id: string;
  clientId: string;
  title: string;
}

/**
 * The task, if the caller may see it. A task assigned to someone else is a
 * 404, never a 403 -- the same answer as a missing id, so existence never
 * leaks (the clients pattern).
 */
export function assertTaskVisible<T extends { assigneeId: string }>(scope: StaffTaskScope, task: T | null): T {
  if (!task || (scope.kind === "own" && task.assigneeId !== scope.userId)) {
    throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
  }
  return task;
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
 * FR-TSK-10, decided for HOK: an **editor** task must carry the raw files link
 * (the editor can't start without the footage); the reference link and the
 * script are optional (not every edit has an example or a script). For any
 * other role the three fields stay empty:
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
  if (assigneeRole === "editor") {
    if (!merged.rawFilesUrl) {
      throw new BadRequestError("An editor task needs the raw files link (Google Drive)", ERROR_CODES.STAFF_TASK_EDITOR_FIELDS_REQUIRED);
    }
    return merged;
  }
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
