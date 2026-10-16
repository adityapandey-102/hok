import {
  ROLE_LABELS,
  STAFF_TASK_PRIORITY_LABELS,
  STAFF_TASK_STATUS_LABELS,
  formatInZone,
  isTaskOverdue,
  type StaffTaskPriority,
  type StaffTaskStatus,
} from "../../../lib/domain";
import { StatusPill, type PillTone } from "../../../components/ui/StatusPill";
import { Icon } from "../../../components/ui/Icon";

export const STATUS_TONES: Record<StaffTaskStatus, PillTone> = {
  todo: "gray",
  in_progress: "blue",
  blocked: "amber",
  done: "green",
};

const PRIORITY_TONES: Record<StaffTaskPriority, PillTone> = {
  low: "gray",
  medium: "purple",
  high: "gold",
  urgent: "red",
};

export function TaskStatusPill({ status }: { status: StaffTaskStatus }) {
  return <StatusPill label={STAFF_TASK_STATUS_LABELS[status]} tone={STATUS_TONES[status]} />;
}

export function PriorityPill({ priority }: { priority: StaffTaskPriority }) {
  return <StatusPill label={STAFF_TASK_PRIORITY_LABELS[priority]} tone={PRIORITY_TONES[priority]} />;
}

/** "Due Tue, 20 Oct 2026, 6:00 pm" in the viewer's zone; red with an "Overdue" pill when past due and not done. */
export function DueLabel({ dueAt, status, zone }: { dueAt: string | null; status: StaffTaskStatus; zone: string }) {
  if (!dueAt) return <span className="text-xs text-text-muted">No due date</span>;
  const overdue = isTaskOverdue({ dueAt, status });
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 text-xs ${overdue ? "font-semibold text-error" : "text-text-muted"}`}>
      <Icon name={overdue ? "alert" : "clock"} size={13} />
      Due {formatInZone(dueAt, zone)}
      {overdue && <StatusPill label="Overdue" tone="red" />}
    </span>
  );
}

export function roleLabel(role: keyof typeof ROLE_LABELS): string {
  return ROLE_LABELS[role];
}

/** The friendly message for a task API error code (falls back to the server's message). */
export function describeTaskError(err: unknown, fallback: string): string {
  const code = (err as { code?: string } | null)?.code;
  switch (code) {
    case "STAFF_TASK_MODIFIED":
      return "Someone else changed this task. Reload to see the latest version.";
    case "STAFF_TASK_DONE":
      return "This task is done. Only the Admin can reopen it.";
    case "STAFF_TASK_STATUS_UNCHANGED":
      return "The task already has that status.";
    case "STAFF_TASK_EDITOR_FIELDS_REQUIRED":
      return "An editor task needs the raw files (Google Drive) link.";
    case "STAFF_TASK_EDITOR_FIELDS_INVALID":
      return "Raw files link, reference link and script are only for editor tasks.";
    case "STAFF_TASK_ASSIGNEE_INVALID":
      return "Choose an active staff member.";
    case "STAFF_TASK_EVENT_INVALID":
      return "That event doesn't belong to the chosen client.";
    case "STAFF_TASK_NOT_FOUND":
      return "This task no longer exists or isn't assigned to you.";
    default:
      return err instanceof Error ? err.message : fallback;
  }
}
