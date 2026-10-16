import type { Role } from "../constants/roles";

/** Staff task types. Mirror hok-api's staff-tasks module responses (REQUIREMENTS §5.9). */

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

export type StaffTaskUpdateKind = "created" | "status" | "comment" | "reassigned" | "reopened";

export interface ReferenceLink {
  url: string;
  label: string | null;
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
  clientId: string | null;
  clientName: string | null;
  eventId: string | null;
  hasEditorBrief: boolean;
  completedAt: string | null;
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
  fromAssigneeName: string | null;
  toAssigneeName: string | null;
  comment: string | null;
  createdAt: string;
}

export interface StaffTask extends Omit<StaffTaskSummary, "hasEditorBrief"> {
  description: string | null;
  assignedBy: string | null;
  assignedByName: string | null;
  eventTitle: string | null;
  rawFilesUrl: string | null;
  referenceUrl: string | null;
  script: string | null;
  referenceLinks: ReferenceLink[];
  updatedAt: string;
  /** Newest first, at most 100. */
  updates: StaffTaskUpdate[];
}

/** Overdue = past its due instant and not done. */
export function isTaskOverdue(task: { dueAt: string | null; status: StaffTaskStatus }, now: number = Date.now()): boolean {
  return task.status !== "done" && task.dueAt !== null && new Date(task.dueAt).getTime() < now;
}

/**
 * The statuses a task can move to from `current` through the status action
 * (assignee or Admin): any other open status, or done. A done task offers
 * none -- only the Admin's reopen.
 */
export function nextStatuses(current: StaffTaskStatus): StaffTaskStatus[] {
  if (current === "done") return [];
  return STAFF_TASK_STATUSES.filter((s) => s !== current);
}

/** Editor tasks (FR-TSK-10) carry a brief; the API requires the raw files link for an editor. */
export function isEditorRole(role: Role | null | undefined): boolean {
  return role === "editor";
}

/** One line for a timeline entry ("moved In progress → Done", "reassigned Meera → Arjun"). */
export function describeTaskUpdate(u: StaffTaskUpdate): string {
  const label = (s: StaffTaskStatus | null) => (s ? STAFF_TASK_STATUS_LABELS[s] : "?");
  switch (u.kind) {
    case "created":
      return `assigned it to ${u.toAssigneeName ?? "someone"}`;
    case "status":
      return `moved it ${label(u.fromStatus)} → ${label(u.toStatus)}`;
    case "reopened":
      return `reopened it (${label(u.toStatus)})`;
    case "reassigned":
      return `reassigned it ${u.fromAssigneeName ?? "?"} → ${u.toAssigneeName ?? "?"}`;
    case "comment":
      return "commented";
  }
}
