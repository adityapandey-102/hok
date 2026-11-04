import type { Approval, ApprovalRecord, ApproverToken, ParentRef, Role, WorkChild, WorkChildRow, WorkParent, WorkParentRecord } from "../../../domain";

/**
 * Pure domain shapes for staff tasks (REQUIREMENTS §5.9). Instants are ISO
 * strings in UTC.
 */

/**
 * FR-TSK-03: To Do -> In Progress -> Done, plus Blocked. Order = the board's columns.
 * Since round 2 the status is DERIVED from the task's stage (see `statusForStage`
 * in staff-task.rules.ts) and the blocked flag; it stays a column because
 * dashboards, filters, the board and reminders all read it.
 */
export const STAFF_TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export type StaffTaskStatus = (typeof STAFF_TASK_STATUSES)[number];

export const STAFF_TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type StaffTaskPriority = (typeof STAFF_TASK_PRIORITIES)[number];

/** List `relation` filter: assigned to me, created by me, or on one of my client teams (managers). */
export const STAFF_TASK_RELATIONS = ["assigned", "created", "team"] as const;
export type StaffTaskRelation = (typeof STAFF_TASK_RELATIONS)[number];

/**
 * Timeline entry kinds (staff_task_updates.kind). `status` is the pre-round-2 move
 * between statuses (old rows only); `stage` / `completed` / `blocked` / `unblocked`
 * are the round-2 ones.
 */
export const STAFF_TASK_UPDATE_KINDS = ["created", "status", "comment", "reassigned", "reopened", "stage", "completed", "blocked", "unblocked"] as const;
export type StaffTaskUpdateKind = (typeof STAFF_TASK_UPDATE_KINDS)[number];

/** The brief (instructions, a script...) stored in the `script` column. */
export const BRIEF_MAX_LENGTH = 20_000;
export const COMMENT_MAX_LENGTH = 2000;
export const BLOCK_REASON_MAX_LENGTH = 1000;
/** Links a task may hold in all, and how many a create may carry. */
export const TASK_LINKS_MAX = 50;
export const TASK_CREATE_LINKS_MAX = 20;
export const TASK_LINK_LABEL_MAX_LENGTH = 120;
/** The DB check on staff_task_links.url (shorter than the 2048 an asset URL may have). */
export const TASK_LINK_URL_MAX_LENGTH = 2000;

/** brief = inputs the assignee works from; delivered = the finished work (can be shared with the client). */
export const TASK_LINK_KINDS = ["brief", "delivered"] as const;
export type TaskLinkKind = (typeof TASK_LINK_KINDS)[number];

/** One of a task's stages (snapshotted from its template at creation; never changes). */
export interface TaskStage {
  id: string;
  /** 1-based order. */
  position: number;
  name: string;
}

/** A stage with its approvers (round 3): what the move gate and the detail read. `approvers` empty = no approval needed. */
export interface TaskStageFull extends TaskStage {
  approvers: ApproverToken[];
}

/** A stage as a detail lists it: with how many unfinished child events/tasks hang on it (round 4). */
export interface TaskStageView extends TaskStageFull {
  openChildren: number;
}

/** The fields the Admin or creator edits (create + PATCH). */
export interface StaffTaskFields {
  title: string;
  description: string | null;
  /** Instructions, a script... for the assignee. Any task. */
  brief: string | null;
  clientId: string | null;
  eventId: string | null;
  dueAt: string | null;
  priority: StaffTaskPriority;
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
  /** The linked client's team (profile ids), for in-memory visibility guards after the lock; [] without a client. Never in a response. */
  teamIds: string[];
  /** The task template it started from, by name ("Simple (older task)" for tasks made before round 2). */
  templateName: string;
  stageCount: number;
  currentStage: TaskStage;
  /** Why it is blocked; set only while status is "blocked". */
  blockedReason: string | null;
  status: StaffTaskStatus;
  completedAt: string | null;
  /** Round 4: the parent this task is a part of and the stage it hangs on; null for a top-level task. Internal. */
  parentRef: ParentRef | null;
  /** 1 = top level, up to 3. Internal. */
  depth: number;
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
  fromStageName: string | null;
  toStageName: string | null;
  comment: string | null;
  createdAt: string;
}

/** One link on a task, with the stage and author names resolved in the same query. */
export interface StaffTaskLink {
  id: string;
  kind: TaskLinkKind;
  url: string;
  label: string | null;
  stageId: string | null;
  stageName: string | null;
  addedById: string | null;
  addedByName: string | null;
  createdAt: string;
  /** The client-visible asset this delivered link became; null until shared. */
  sharedAssetId: string | null;
}

/** GET /staff-tasks/:id: the task + the event's title + its stages, links and newest updates. */
export interface StaffTaskDetail extends StaffTaskEntity {
  /** Null when there's no event, or the events table isn't there yet. */
  eventTitle: string | null;
  stages: TaskStageView[];
  /** Round 3: every approval round, newest first, capped. Becomes `approvals` (with the caller's flags) in the view. */
  approvalRecords: ApprovalRecord[];
  /** Round 4: the parent (with what visibility needs), the children (up to 200 per kind) and how many the database counted in all. */
  parentRecord: WorkParentRecord | null;
  childRows: WorkChildRow[];
  childTotal: number;
  /** Oldest first, at most TASK_LINKS_MAX. */
  links: StaffTaskLink[];
  updates: StaffTaskUpdate[];
}

/** A list row: what a list or board card shows (no description, brief or links). */
export interface StaffTaskSummaryEntity {
  id: string;
  title: string;
  status: StaffTaskStatus;
  priority: StaffTaskPriority;
  dueAt: string | null;
  assigneeId: string;
  assigneeName: string;
  assigneeRole: Role;
  /** Who created (assigned) it; null if that account is gone. */
  assignedById: string | null;
  assignedByName: string | null;
  clientId: string | null;
  clientName: string | null;
  eventId: string | null;
  templateName: string;
  stageCount: number;
  currentStage: TaskStage;
  blockedReason: string | null;
  completedAt: string | null;
  version: number;
  createdAt: string;
}

/**
 * What the caller gets back: the row plus whether *they* may edit, reassign,
 * reopen and delete it (the Admin, or its creator while they still hold
 * staff_tasks:assign) and whether they may share its delivered links with the
 * client, so the web needs no role logic of its own.
 */
export type StaffTaskDetailView = Omit<StaffTaskDetail, "approvalRecords" | "parentRef" | "depth" | "parentRecord" | "childRows" | "childTotal"> & {
  canManage: boolean;
  canShare: boolean;
  approvals: Approval[];
  /** The stage that stops forward moves right now (it needs an approval, or has unfinished parts), or null. */
  nextBlockedBy: { stageId: string; stageName: string; reason: "approval" | "children"; openChildren: number } | null;
  /** "Part of: <parent> > <stage>": null for a top-level task, or when the caller can't see the parent. */
  parent: WorkParent | null;
  /** The child events and tasks the caller can see (parent-stage order), and how many more exist that they can't. */
  children: WorkChild[];
  hiddenChildren: number;
};
export type StaffTaskSummaryView = StaffTaskSummaryEntity & { canManage: boolean };
