import type { Role } from "../../../domain";

/**
 * Pure domain shapes for staff tasks (REQUIREMENTS §5.9). Instants are ISO
 * strings in UTC.
 */

/** FR-TSK-03: To Do -> In Progress -> Done, plus Blocked. Order = the board's columns. */
export const STAFF_TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export type StaffTaskStatus = (typeof STAFF_TASK_STATUSES)[number];

/** The statuses a task can be reopened to (anything but done). */
export const OPEN_STAFF_TASK_STATUSES = ["todo", "in_progress", "blocked"] as const satisfies readonly StaffTaskStatus[];
export type OpenStaffTaskStatus = (typeof OPEN_STAFF_TASK_STATUSES)[number];

export const STAFF_TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type StaffTaskPriority = (typeof STAFF_TASK_PRIORITIES)[number];

/** Timeline entry kinds (staff_task_updates.kind). */
export const STAFF_TASK_UPDATE_KINDS = ["created", "status", "comment", "reassigned", "reopened"] as const;
export type StaffTaskUpdateKind = (typeof STAFF_TASK_UPDATE_KINDS)[number];

/** At most this many reference links per task (DB CHECK too). */
export const REFERENCE_LINKS_MAX = 10;
export const SCRIPT_MAX_LENGTH = 20_000;
export const COMMENT_MAX_LENGTH = 2000;

export interface ReferenceLink {
  url: string;
  label: string | null;
}

/** FR-TSK-10: the brief an editor works from. Empty (all null) on everyone else's tasks. */
export interface EditorFields {
  rawFilesUrl: string | null;
  referenceUrl: string | null;
  script: string | null;
}

/** The fields the Admin edits (create + PATCH). */
export interface StaffTaskFields extends EditorFields {
  title: string;
  description: string | null;
  clientId: string | null;
  eventId: string | null;
  dueAt: string | null;
  priority: StaffTaskPriority;
  referenceLinks: ReferenceLink[];
}

/** A task in full, as one locked/visible row (no timeline). */
export interface StaffTaskEntity extends StaffTaskFields {
  id: string;
  assigneeId: string;
  assigneeName: string;
  assigneeRole: Role;
  assignedBy: string | null;
  assignedByName: string | null;
  clientName: string | null;
  status: StaffTaskStatus;
  completedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** One timeline entry, with names resolved in the same query. */
export interface StaffTaskUpdate {
  id: string;
  kind: StaffTaskUpdateKind;
  authorId: string | null;
  authorName: string | null;
  fromStatus: StaffTaskStatus | null;
  toStatus: StaffTaskStatus | null;
  fromAssigneeName: string | null;
  toAssigneeName: string | null;
  comment: string | null;
  createdAt: string;
}

/** GET /staff-tasks/:id: the task + the event's title + its newest updates. */
export interface StaffTaskDetail extends StaffTaskEntity {
  /** Null when there's no event, or the events table isn't there yet. */
  eventTitle: string | null;
  updates: StaffTaskUpdate[];
}

/** A list row: what a list or board card shows (no description, script or links). */
export interface StaffTaskSummaryEntity {
  id: string;
  title: string;
  status: StaffTaskStatus;
  priority: StaffTaskPriority;
  dueAt: string | null;
  assigneeId: string;
  assigneeName: string;
  assigneeRole: Role;
  clientId: string | null;
  clientName: string | null;
  eventId: string | null;
  /** True when the task carries an editor brief (raw files link). */
  hasEditorBrief: boolean;
  completedAt: string | null;
  version: number;
  createdAt: string;
}
