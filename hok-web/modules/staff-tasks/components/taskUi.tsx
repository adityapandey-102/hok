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
  medium: "gray",
  high: "amber",
  urgent: "red",
};

/** True when the due moment falls on today's calendar date in `zone`. */
function isDueToday(dueAt: string, zone: string): boolean {
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return day(new Date(dueAt)) === day(new Date());
}

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
  const today = !overdue && status !== "done" && isDueToday(dueAt, zone);
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 text-xs ${overdue ? "font-semibold text-error" : today ? "font-medium text-warning-text" : "text-text-muted"}`}>
      <span className="inline-flex items-center gap-1.5">
        <Icon name={overdue ? "alert" : "clock"} size={13} className="shrink-0" />
        Due {formatInZone(dueAt, zone)}
      </span>
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

/** Left accent per priority: urgent crimson, high amber, the rest a quiet hairline. */
export const PRIORITY_ACCENT: Record<StaffTaskPriority, string> = {
  low: "bg-border",
  medium: "bg-border",
  high: "bg-warning",
  urgent: "bg-primary",
};

/** Two-letter initials in an ink disc (the assignee). */
export function PersonDot({ name, size = 28 }: { name: string; size?: number }) {
  const text = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      title={name}
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-ink text-[10.5px] font-semibold text-on-ink"
    >
      {text}
    </span>
  );
}

/** A compact due chip: "Overdue · 13 Oct" in red, "Today" in amber, otherwise muted. Done tasks show nothing. */
export function DueChip({ dueAt, status, zone }: { dueAt: string | null; status: StaffTaskStatus; zone: string }) {
  if (status === "done") return null;
  if (!dueAt) return <span className="inline-flex items-center gap-1 rounded-app-sm bg-gray-pill-bg px-2 py-0.5 text-xs text-text-muted">No due date</span>;
  const overdue = isTaskOverdue({ dueAt, status });
  const today = !overdue && isDueToday(dueAt, zone);
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "numeric", month: "short" }).format(new Date(dueAt));
  const tone = overdue ? "bg-error-bg text-error font-semibold" : today ? "bg-warning-bg text-warning-text font-medium" : "bg-gray-pill-bg text-text-secondary";
  return (
    <span className={`inline-flex items-center gap-1 rounded-app-sm px-2 py-0.5 text-xs whitespace-nowrap ${tone}`}>
      <Icon name={overdue ? "alert" : "clock"} size={12} />
      {overdue ? `Overdue · ${date}` : today ? "Due today" : `Due ${date}`}
    </span>
  );
}
