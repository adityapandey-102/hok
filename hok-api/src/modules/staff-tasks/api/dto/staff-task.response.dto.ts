import type { Approval, Role } from "../../../../domain";
import type { StaffTaskPriority, StaffTaskStatus, StaffTaskUpdateKind, TaskLinkKind, TaskStage, TaskStageFull } from "../../domain/staff-task.entity";

/** One row of GET /staff-tasks (and a board card). */
export interface StaffTaskSummaryResponseDto {
  id: string;
  title: string;
  status: StaffTaskStatus;
  priority: StaffTaskPriority;
  dueAt: string | null;
  assigneeId: string;
  assigneeName: string;
  assigneeRole: Role;
  assignedById: string | null;
  assignedByName: string | null;
  clientId: string | null;
  clientName: string | null;
  eventId: string | null;
  /** The task template it started from; "Simple (older task)" for tasks made before stages existed. */
  templateName: string;
  stageCount: number;
  currentStage: TaskStage;
  /** Why it is blocked; null unless status is "blocked". */
  blockedReason: string | null;
  completedAt: string | null;
  version: number;
  createdAt: string;
  /** The caller may edit, reassign, reopen and delete this task (Admin, or its creator with assign rights). */
  canManage: boolean;
}

export interface StaffTaskUpdateResponseDto {
  id: string;
  kind: StaffTaskUpdateKind;
  authorId: string | null;
  authorName: string | null;
  fromStatus: StaffTaskStatus | null;
  toStatus: StaffTaskStatus | null;
  fromAssigneeName: string | null;
  toAssigneeName: string | null;
  /** The stage a move left / reached (stage, reopened); a completion and a block name the stage they happened at as `fromStageName`. */
  fromStageName: string | null;
  toStageName: string | null;
  comment: string | null;
  createdAt: string;
}

export interface StaffTaskLinkResponseDto {
  id: string;
  kind: TaskLinkKind;
  url: string;
  label: string | null;
  stageId: string | null;
  stageName: string | null;
  addedById: string | null;
  addedByName: string | null;
  createdAt: string;
  /** The client-visible asset a delivered link was shared as; null until shared. */
  sharedAssetId: string | null;
}

/** GET /staff-tasks/:id and every write's `{ task }`. */
export interface StaffTaskDetailResponseDto {
  id: string;
  title: string;
  description: string | null;
  /** Instructions or a script for the assignee. */
  brief: string | null;
  status: StaffTaskStatus;
  priority: StaffTaskPriority;
  dueAt: string | null;
  assigneeId: string;
  assigneeName: string;
  assigneeRole: Role;
  /** Same as `assignedById`; kept for existing clients. */
  assignedBy: string | null;
  assignedById: string | null;
  assignedByName: string | null;
  clientId: string | null;
  clientName: string | null;
  eventId: string | null;
  eventTitle: string | null;
  templateName: string;
  stageCount: number;
  currentStage: TaskStage;
  /** Every stage of the task, in order, with the tokens that can approve it (empty = no approval needed). */
  stages: TaskStageFull[];
  blockedReason: string | null;
  /** Oldest first, at most 50. */
  links: StaffTaskLinkResponseDto[];
  completedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** The caller may edit, reassign, reopen and delete this task (Admin, or its creator with assign rights). */
  canManage: boolean;
  /** The caller may share this task's delivered links with the client (the task has an event and they can write assets on its client). */
  canShare: boolean;
  /** Every approval round on this task, newest first, at most 100, with what the caller may do. */
  approvals: Approval[];
  /** The approval stage that stops forward moves right now (and completing), or null. */
  nextBlockedBy: { stageId: string; stageName: string } | null;
  /** Newest first, at most 100. */
  updates: StaffTaskUpdateResponseDto[];
}
