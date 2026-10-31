/**
 * Activity log (FR-SYS-02, FR-RPT-05): the Admin's readable history of who did
 * what, newest first. Read-only; owns no table. Rows come from five sources
 * (audit_log and the four typed history tables), are normalised in SQL and
 * turned into plain-English sentences here, in the domain layer.
 */

export const ACTIVITY_PAGE_DEFAULT = 50;
export const ACTIVITY_PAGE_MAX = 50;
/** Default window ("the last 7 days") and the widest window a request may ask for. */
export const ACTIVITY_DEFAULT_DAYS = 7;
export const ACTIVITY_MAX_SPAN_DAYS = 31;

export const ACTIVITY_FILTER_KINDS = ["all", "clients", "events", "tasks", "comments", "assets", "accounts"] as const;
export type ActivityFilterKind = (typeof ACTIVITY_FILTER_KINDS)[number];
export type ActivityKind = Exclude<ActivityFilterKind, "all">;

/** Which audit_log action prefixes belong to which kind. */
export const AUDIT_PREFIXES_BY_KIND: Record<ActivityKind, readonly string[]> = {
  clients: ["client.", "portal_link."],
  events: ["event.", "personal_event.", "stage_template."],
  tasks: ["staff_task.", "client_todo."],
  comments: ["comment."],
  assets: ["asset."],
  accounts: ["auth.", "user.", "calendar_feed."],
};

export type ActivitySource = "audit" | "stage" | "task" | "comment" | "comment_status";

export interface ActivityFilter {
  from: Date;
  to: Date;
  kind: ActivityFilterKind;
  actorId?: string;
}

/**
 * One normalised row with its names already joined in. `action` is the audit
 * action, the task-update kind, or a fixed word for the other sources.
 * Never carries bodies, tokens or contact details.
 */
export interface ActivityRow {
  id: string;
  at: Date;
  kind: ActivityKind;
  source: ActivitySource;
  action: string;
  actorId: string | null;
  actorName: string | null;
  clientId: string | null;
  clientName: string | null;
  eventId: string | null;
  eventTitle: string | null;
  taskId: string | null;
  taskTitle: string | null;
  /** The new assignee / new owner (reassignments). */
  subjectName: string | null;
  /** The person an account action (user.*) is about. */
  targetUserId: string | null;
  targetUserName: string | null;
  assetTitle: string | null;
  todoTitle: string | null;
  templateName: string | null;
  stageName: string | null;
  fromStatus: string | null;
  toStatus: string | null;
}

export interface ActivityItem {
  id: string;
  at: string;
  kind: ActivityKind;
  actor: { id: string; name: string } | null;
  summary: string;
  url: string | null;
}

export interface ActivityPage {
  items: ActivityItem[];
  total: number;
  limit: number;
  offset: number;
}
