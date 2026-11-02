import type { Role } from "../../../../domain";
import type { ReferenceLink, StaffTaskPriority, StaffTaskStatus, StaffTaskUpdateKind } from "../../domain/staff-task.entity";

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
  hasEditorBrief: boolean;
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
  comment: string | null;
  createdAt: string;
}

/** GET /staff-tasks/:id and every write's `{ task }`. */
export interface StaffTaskDetailResponseDto {
  id: string;
  title: string;
  description: string | null;
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
  rawFilesUrl: string | null;
  referenceUrl: string | null;
  script: string | null;
  referenceLinks: ReferenceLink[];
  completedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** The caller may edit, reassign, reopen and delete this task (Admin, or its creator with assign rights). */
  canManage: boolean;
  /** Newest first, at most 100. */
  updates: StaffTaskUpdateResponseDto[];
}
