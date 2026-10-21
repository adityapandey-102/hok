import { NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import {
  WORKING_WINDOW_HOURS,
  type ClientReport,
  type StaffReport,
  type TeamStatusPage,
} from "../domain/report.entity";
import { monthWeeks, monthWindow, teamStatus } from "../domain/report.rules";
import type { ReportRepositoryPort, TeamStatusFilter } from "./ports/report-repository.port";

/**
 * Admin reports (FR-RPT-01..04). The Admin sees everything, so there is no
 * row scope here; the route's `dashboard:global` capability is the gate.
 * Query counts: team status 2 (rows + total, in parallel); staff report 2
 * (person, then the figures); client report 6 (client, then 5 in parallel).
 */
export class ReportsService {
  constructor(
    private readonly repo: ReportRepositoryPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async teamStatusPage(filter: TeamStatusFilter, limit: number, offset: number): Promise<TeamStatusPage> {
    const now = this.clock();
    const since = new Date(now.getTime() - WORKING_WINDOW_HOURS * 3_600_000);
    const [rows, total] = await Promise.all([
      this.repo.teamStatus(filter, since, now, limit, offset),
      this.repo.teamStatusCount(filter, since, now),
    ]);
    return {
      members: rows.map((r) => ({
        userId: r.userId,
        name: r.name,
        role: r.role,
        lastSeenAt: r.lastSeenAt?.toISOString() ?? null,
        openTasks: r.openTasks,
        overdue: r.overdue,
        activityLast24h: r.activityLast24h,
        status: teamStatus({ openTasks: r.openTasks, lastSeenAt: r.lastSeenAt, activityLast24h: r.activityLast24h, now }),
      })),
      total,
      limit,
      offset,
      rule: { windowHours: WORKING_WINDOW_HOURS, asOf: now.toISOString() },
    };
  }

  async staffReport(userId: string, month: string, timeZone: string): Promise<StaffReport> {
    const now = this.clock();
    const window = monthWindow(month, now, timeZone);
    const weeks = monthWeeks(month, timeZone);
    const person = await this.repo.person(userId);
    if (!person) throw new NotFoundError("User not found", ERROR_CODES.USER_NOT_FOUND);
    const f = await this.repo.staffFigures(userId, window, weeks, now);
    return {
      month: window,
      person: { userId: person.userId, name: person.name, role: person.role, lastSeenAt: person.lastSeenAt?.toISOString() ?? null },
      assigned: f.assigned,
      completed: f.completed,
      onTime: f.onTime,
      late: f.late,
      avgDaysToComplete: f.avgDaysToComplete,
      openNow: f.openNow,
      overdueNow: f.overdueNow,
      weeks: weeks.map((w, i) => ({ startDay: w.startDay, endDay: w.endDay, ...f.weeks[i]! })),
    };
  }

  async clientReport(clientId: string, month: string, timeZone: string): Promise<ClientReport> {
    const window = monthWindow(month, this.clock(), timeZone);
    const client = await this.repo.client(clientId);
    if (!client) throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
    return { month: window, client, ...(await this.repo.clientFigures(clientId, window)) };
  }
}
