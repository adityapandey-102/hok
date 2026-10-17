import type { Role } from "../../../domain";
import type { CommentStatus } from "../../client-comments/domain/client-comment.entity";
import type { EventState, EventType } from "../../events/domain/event.entity";
import type { StaffTaskPriority, StaffTaskStatus } from "../../staff-tasks/domain/staff-task.entity";

/**
 * Role dashboards (REQUIREMENTS §5.11, FR-DSH-01..03). One read, shaped by
 * role: everyone gets `tasks` (their own staff tasks); Admin, SMM and MM also
 * get `clients` (their own clients, FR-DSH-02, which the Admin sees too as
 * "own clients' widgets"); only the Admin gets `firm` (FR-DSH-01). Figures
 * are SQL aggregates and every list is capped, so the query count is fixed
 * and never grows with the data. Instants are UTC ISO strings; day windows
 * ("today", "this week") are the viewer's own time zone.
 */

/** Cap on every list a dashboard shows. */
export const DASHBOARD_LIST_LIMIT = 8;
/** "Upcoming" = today plus the next 6 days (a week strip). */
export const DASHBOARD_WEEK_DAYS = 7;
/** Events fetched for the week strip (today + upcoming share one capped query). */
export const DASHBOARD_EVENTS_LIMIT = 20;
/** Team workload rows (active non-admin staff). */
export const DASHBOARD_TEAM_LIMIT = 50;
/** Stage groups shown in "events by stage". */
export const DASHBOARD_STAGE_GROUPS = 8;

/** The viewer's day windows: [todayStart, tomorrowStart) and [todayStart, weekEnd). */
export interface DashboardWindow {
  timeZone: string;
  today: string;
  todayStart: string;
  tomorrowStart: string;
  weekEnd: string;
}

export interface TaskStatusCounts {
  todo: number;
  in_progress: number;
  blocked: number;
  done: number;
}

export interface DashboardTask {
  id: string;
  title: string;
  status: StaffTaskStatus;
  priority: StaffTaskPriority;
  dueAt: string | null;
  clientName: string | null;
  /** Filled on the Admin's firm-wide lists; null on the viewer's own tasks. */
  assigneeName: string | null;
}

/** A comment someone else left on one of the viewer's tasks (FR-DSH-03). */
export interface DashboardTaskComment {
  id: string;
  taskId: string;
  taskTitle: string;
  authorName: string | null;
  comment: string;
  createdAt: string;
}

export interface DashboardEvent {
  id: string;
  title: string;
  type: EventType;
  state: EventState;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  clientId: string;
  clientName: string;
  currentStageName: string;
  currentStagePosition: number;
  stageCount: number;
}

export interface DashboardComment {
  id: string;
  clientId: string;
  clientName: string;
  eventTitle: string | null;
  /** First 160 characters. */
  excerpt: string;
  status: CommentStatus;
  createdAt: string;
}

export interface StageGroup {
  stageName: string;
  count: number;
}

export interface WorkloadRow {
  userId: string;
  name: string;
  role: Role;
  open: number;
  overdue: number;
  /** Closed in the last 7 days. */
  doneThisWeek: number;
}

/** FR-DSH-02/03: the viewer's own staff tasks. */
export interface TasksSection {
  counts: TaskStatusCounts;
  dueToday: number;
  overdue: number;
  /** Open tasks, overdue and soonest-due first. */
  open: DashboardTask[];
  recentComments: DashboardTaskComment[];
}

/** FR-DSH-02: the viewer's own clients. */
export interface ClientsSection {
  clientCount: number;
  /** Events overlapping today. */
  today: DashboardEvent[];
  /** Events starting after today, within the week. */
  upcoming: DashboardEvent[];
  /** Active events that haven't ended, grouped by their current stage name. */
  byStage: StageGroup[];
  unresolvedComments: { received: number; inProgress: number };
  latestComments: DashboardComment[];
}

/** FR-DSH-01: the whole firm (Admin only). */
export interface FirmSection {
  totals: { clients: number; activeEvents: number; openTasks: number; unresolvedComments: number };
  tasksByStatus: TaskStatusCounts;
  /** Firm events overlapping today .. the week's end. */
  week: DashboardEvent[];
  overdueTasks: DashboardTask[];
  latestComments: DashboardComment[];
  team: WorkloadRow[];
}

export interface Dashboard {
  role: Role;
  window: DashboardWindow;
  tasks: TasksSection;
  clients: ClientsSection | null;
  firm: FirmSection | null;
}
