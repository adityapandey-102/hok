import type {
  DashboardComment,
  DashboardEvent,
  DashboardTask,
  DashboardTaskComment,
  FirmSection,
  StageGroup,
  TaskStatusCounts,
  WorkloadRow,
} from "../../domain/dashboard.entity";

export interface Window {
  now: Date;
  todayStart: Date;
  tomorrowStart: Date;
  weekEnd: Date;
}

/**
 * Read-only aggregates for the dashboards. Every method is ONE query with a
 * fixed shape: counts come from `count(*) filter (...)`, lists are capped.
 * `ownerId` undefined = the whole firm (Admin's firm section only).
 */
export interface DashboardRepositoryPort {
  /** The assignee's task counts by status + due today + overdue (open tasks only). */
  taskSummary(assigneeId: string, w: Window): Promise<{ counts: TaskStatusCounts; dueToday: number; overdue: number }>;
  /** Open tasks, overdue and soonest-due first (no due date last). `overdueOnly` = due before now. */
  openTasks(filter: { assigneeId?: string; overdueOnly?: boolean }, now: Date, limit: number): Promise<DashboardTask[]>;
  /** Latest comments left by OTHER people on the assignee's tasks. */
  recentTaskComments(assigneeId: string, limit: number): Promise<DashboardTaskComment[]>;
  /** The owner's non-archived client count + their unresolved comment counts. */
  clientSummary(ownerId: string): Promise<{ clientCount: number; received: number; inProgress: number }>;
  /** Events overlapping [from, to), earliest first, capped. */
  events(range: { from: Date; to: Date }, ownerId: string | undefined, limit: number): Promise<DashboardEvent[]>;
  /** Active, not-yet-ended events grouped by current stage name, biggest first. */
  eventsByStage(ownerId: string, now: Date, limit: number): Promise<StageGroup[]>;
  /** Newest unresolved client comments. */
  latestComments(ownerId: string | undefined, limit: number): Promise<DashboardComment[]>;
  /** Firm totals + firm task counts by status. */
  firmTotals(now: Date): Promise<Pick<FirmSection, "totals" | "tasksByStatus">>;
  /** Active non-admin staff with their open / overdue / done-this-week task counts. */
  team(now: Date, limit: number): Promise<WorkloadRow[]>;
}
