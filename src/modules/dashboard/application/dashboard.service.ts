import type { Role } from "../../../domain";
import {
  DASHBOARD_EVENTS_LIMIT,
  DASHBOARD_LIST_LIMIT,
  DASHBOARD_STAGE_GROUPS,
  DASHBOARD_TEAM_LIMIT,
  type ClientsSection,
  type Dashboard,
  type FirmSection,
  type TasksSection,
  type DashboardView,
  type TeamWorkloadPage,
} from "../domain/dashboard.entity";
import { dashboardSections, dashboardWindow, splitWeek } from "../domain/dashboard.rules";
import type { DashboardRepositoryPort, TeamFilter, Window } from "./ports/dashboard-repository.port";

export interface DashboardViewer {
  userId: string;
  role: Role;
  timeZone: string;
}

/**
 * Builds a role's dashboard (FR-DSH-01..03). Sections the role doesn't get
 * are never queried. All queries run in parallel; the count is fixed per
 * role and view (task-only staff 3, managers 7, the Admin's overview 5 and
 * "My clients" 7) whatever the data size.
 */
export class DashboardService {
  constructor(
    private readonly repo: DashboardRepositoryPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async get(viewer: DashboardViewer, view: DashboardView = "overview"): Promise<Dashboard> {
    const now = this.clock();
    const window = dashboardWindow(now, viewer.timeZone);
    const w: Window = {
      now,
      todayStart: new Date(window.todayStart),
      tomorrowStart: new Date(window.tomorrowStart),
      weekEnd: new Date(window.weekEnd),
    };
    const sections = dashboardSections(viewer.role, view);

    const [tasks, clients, firm] = await Promise.all([
      sections.tasks ? this.tasks(viewer.userId, w) : Promise.resolve(null),
      sections.clients ? this.clients(viewer.userId, w, window) : Promise.resolve(null),
      sections.firm ? this.firm(w) : Promise.resolve(null),
    ]);
    return { role: viewer.role, view, window, tasks, clients, firm };
  }

  private async tasks(userId: string, w: Window): Promise<TasksSection> {
    const [summary, open, recentComments] = await Promise.all([
      this.repo.taskSummary(userId, w),
      this.repo.openTasks({ assigneeId: userId }, w.now, DASHBOARD_LIST_LIMIT),
      this.repo.recentTaskComments(userId, DASHBOARD_LIST_LIMIT),
    ]);
    return { ...summary, open, recentComments };
  }

  private async clients(ownerId: string, w: Window, window: Dashboard["window"]): Promise<ClientsSection> {
    const [summary, week, byStage, latestComments] = await Promise.all([
      this.repo.clientSummary(ownerId, w),
      this.repo.events({ from: w.todayStart, to: w.weekEnd }, ownerId, DASHBOARD_EVENTS_LIMIT),
      this.repo.eventsByStage(ownerId, w.now, DASHBOARD_STAGE_GROUPS),
      this.repo.latestComments(ownerId, DASHBOARD_LIST_LIMIT),
    ]);
    return {
      clientCount: summary.clientCount,
      weekEventCount: summary.weekEventCount,
      ...splitWeek(week, window),
      byStage,
      unresolvedComments: { received: summary.received, inProgress: summary.inProgress },
      latestComments,
    };
  }

  private async firm(w: Window): Promise<FirmSection> {
    const [totals, week, overdueTasks, latestComments, team] = await Promise.all([
      this.repo.firmTotals(w),
      this.repo.events({ from: w.todayStart, to: w.weekEnd }, undefined, DASHBOARD_EVENTS_LIMIT),
      this.repo.openTasks({ overdueOnly: true }, w.now, DASHBOARD_LIST_LIMIT),
      this.repo.latestComments(undefined, DASHBOARD_LIST_LIMIT),
      this.repo.team(w.now, {}, DASHBOARD_TEAM_LIMIT, 0),
    ]);
    return { ...totals, week, overdueTasks, latestComments, team };
  }

  /** The whole team's workload (Admin): searched and paged by the database, busiest first. Two queries. */
  async teamPage(filter: TeamFilter, limit: number, offset: number): Promise<TeamWorkloadPage> {
    const [members, total] = await Promise.all([this.repo.team(this.clock(), filter, limit, offset), this.repo.teamCount(filter)]);
    return { members, total, limit, offset };
  }
}
