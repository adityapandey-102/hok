import type { Role } from "../constants/roles";
import type { Approval, ApproverToken, NextBlockedBy } from "./approval";
import type { WorkChild, WorkParent } from "./work";

/** Staff task types. Mirror hok-api's staff-tasks module responses (REQUIREMENTS §5.9, round 2 contract §7). */

/** FR-TSK-03. Order = the board's columns. */
export const STAFF_TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export type StaffTaskStatus = (typeof STAFF_TASK_STATUSES)[number];
export type OpenStaffTaskStatus = Exclude<StaffTaskStatus, "done">;

export const STAFF_TASK_STATUS_LABELS: Record<StaffTaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export const STAFF_TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type StaffTaskPriority = (typeof STAFF_TASK_PRIORITIES)[number];

export const STAFF_TASK_PRIORITY_LABELS: Record<StaffTaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export type StaffTaskUpdateKind = "created" | "status" | "comment" | "reassigned" | "reopened" | "stage" | "completed" | "blocked" | "unblocked";

/** Most links a task holds, and most the create form takes (the API's limits). */
export const TASK_LINKS_MAX = 50;
export const TASK_BRIEF_LINKS_MAX_ON_CREATE = 20;

/** A stage of one task: copied from its template when the task was created, then fixed. */
export interface TaskStage {
  id: string;
  name: string;
  position: number;
  /** Who may approve this stage (round 3); empty = no approval needed. */
  approvers: ApproverToken[];
  /** Unfinished parts hanging on this stage (round 4). */
  openChildren?: number;
}

export type TaskLinkKind = "brief" | "delivered";

export const TASK_LINK_KIND_LABELS: Record<TaskLinkKind, string> = {
  brief: "Brief and inputs",
  delivered: "Delivered work",
};

export interface TaskLink {
  id: string;
  kind: TaskLinkKind;
  url: string;
  label: string | null;
  stageId: string | null;
  stageName: string | null;
  addedById: string | null;
  addedByName: string | null;
  createdAt: string;
  /** Set once the link was shared with the client (an asset exists for it). */
  sharedAssetId: string | null;
}

export interface StaffTaskSummary {
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
  completedAt: string | null;
  /** The template the stages were copied from (a name, kept even if the template is gone). */
  templateName: string;
  stageCount: number;
  currentStage: TaskStage;
  /** Why the assignee flagged it blocked; null when it is not blocked. */
  blockedReason: string | null;
  /** The caller is the Admin, or the creator with assign rights: they may edit, reassign, reopen and delete it. Decided by the API. */
  canManage: boolean;
  version: number;
  createdAt: string;
}

export interface StaffTaskUpdate {
  id: string;
  kind: StaffTaskUpdateKind;
  authorId: string | null;
  authorName: string | null;
  fromStatus: StaffTaskStatus | null;
  toStatus: StaffTaskStatus | null;
  fromStageName: string | null;
  toStageName: string | null;
  fromAssigneeName: string | null;
  toAssigneeName: string | null;
  comment: string | null;
  createdAt: string;
}

export interface StaffTask extends StaffTaskSummary {
  description: string | null;
  /** The instructions or script (every task has one, optional). */
  brief: string | null;
  eventTitle: string | null;
  stages: TaskStage[];
  /** Every approval round, newest first (at most 100). */
  approvals: Approval[];
  /** The approval stage that stops forward moves, or null. */
  nextBlockedBy: NextBlockedBy | null;
  links: TaskLink[];
  /** The caller may share a delivered link with the client: the task has an event and they manage that client (Admin or on its team). Decided by the API. */
  canShare: boolean;
  /** Round 4: the item this one is a part of (null when top-level or not visible to the caller). */
  parent: WorkParent | null;
  /** The parts the caller can see, in parent-stage order. */
  children: WorkChild[];
  /** Parts that exist but the caller cannot see (they still hold the parent's stage). */
  hiddenChildren: number;
  updatedAt: string;
  /** Newest first, at most 100. */
  updates: StaffTaskUpdate[];
}

/** Overdue = past its due instant and not done. */
export function isTaskOverdue(task: { dueAt: string | null; status: StaffTaskStatus }, now: number = Date.now()): boolean {
  return task.status !== "done" && task.dueAt !== null && new Date(task.dueAt).getTime() < now;
}

/** One line for a timeline entry ("moved it Edit → Review", "completed it", "blocked it", "reassigned Meera → Arjun"). */
export function describeTaskUpdate(u: StaffTaskUpdate): string {
  const label = (s: StaffTaskStatus | null) => (s ? STAFF_TASK_STATUS_LABELS[s] : "?");
  switch (u.kind) {
    case "created":
      return `assigned it to ${u.toAssigneeName ?? "someone"}`;
    case "stage":
      return `moved it ${u.fromStageName ?? "?"} → ${u.toStageName ?? "?"}`;
    case "completed":
      return "completed it";
    case "blocked":
      return "marked it blocked";
    case "unblocked":
      return "unblocked it";
    case "status":
      // Older entries (before stages) moved the status directly.
      return `moved it ${label(u.fromStatus)} → ${label(u.toStatus)}`;
    case "reopened":
      return u.toStageName ? `reopened it at ${u.toStageName}` : `reopened it (${label(u.toStatus)})`;
    case "reassigned":
      return `reassigned it ${u.fromAssigneeName ?? "?"} → ${u.toAssigneeName ?? "?"}`;
    case "comment":
      return "commented";
  }
}
