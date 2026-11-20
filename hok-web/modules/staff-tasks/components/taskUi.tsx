import {
  ROLE_LABELS,
  STAFF_TASK_PRIORITY_LABELS,
  STAFF_TASK_STATUS_LABELS,
  formatInZone,
  isTaskOverdue,
  stageProgressLabel,
  workErrorMessage,
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

/** Where the task is: "Rough cut · 2/5". Shown next to the status pill on lists and cards. */
export function StageChip({ stage, count }: { stage: { name: string; position: number }; count: number }) {
  return (
    <span title={`Stage ${stage.position} of ${count}`} className="inline-flex max-w-[16rem] items-center rounded-full bg-accent-bg px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-text-secondary ring-1 ring-border ring-inset">
      <span className="truncate">{stageProgressLabel(stage, count)}</span>
    </span>
  );
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
      return "This task is done. Only the person who gave it (or the Admin) can reopen it.";
    case "STAFF_TASK_TEMPLATE_INVALID":
      return "That template isn't available for this person. Pick another.";
    case "STAFF_TASK_NOT_AT_LAST_STAGE":
      return "A task can only be completed from its last stage.";
    case "STAFF_TASK_STAGE_INVALID":
      return "That stage doesn't belong to this task.";
    case "STAFF_TASK_STAGE_UNCHANGED":
      return "The task is already at that stage.";
    case "STAFF_TASK_ALREADY_BLOCKED":
      return "The task is already marked blocked.";
    case "STAFF_TASK_NOT_BLOCKED":
      return "The task isn't blocked.";
    case "STAFF_TASK_LINKS_LIMIT":
      return "A task can hold at most 50 links.";
    case "STAFF_TASK_LINK_ALREADY_SHARED":
      return "That link was already shared with the client.";
    case "STAFF_TASK_NO_EVENT":
      return "Link the task to an event first: the client sees shared work on its event.";
    case "STAFF_TASK_LINK_NOT_FOUND":
      return "That link no longer exists.";
    case "STAFF_TASK_ASSIGNEE_INVALID":
      return "Choose an active staff member.";
    case "STAFF_TASK_EVENT_INVALID":
      return "That event doesn't belong to the chosen client.";
    case "STAFF_TASK_NOT_FOUND":
      return "This task no longer exists or isn't visible to you.";
    case "STAFF_TASK_FORBIDDEN":
      return "You can look at this task, but only its assignee, the person who gave it or the Admin can change it.";
    case "STAFF_TASK_ASSIGNEE_NOT_ALLOWED":
      return "You can't assign a task to someone with this role.";
    case "STAFF_TASK_CLIENT_INVALID":
      return "Choose one of your own clients (or an event of one).";
    default:
      return workErrorMessage(code) ?? (err instanceof Error ? err.message : fallback);
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
