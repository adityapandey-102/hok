import type { ClientCommentStatusCounts } from "../lib/reportFormat";
import type { EventState, EventType, Role } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";

/** Wire shapes of GET /reports/* (mirror hok-api's modules/reports/domain/report.entity.ts). */
export type TeamStatus = "working" | "idle";

export interface TeamStatusRow {
  userId: string;
  name: string;
  role: Role;
  lastSeenAt: string | null;
  openTasks: number;
  overdue: number;
  activityLast24h: number;
  status: TeamStatus;
}

export interface TeamStatusPage {
  members: TeamStatusRow[];
  total: number;
  limit: number;
  offset: number;
  rule: { windowHours: number; asOf: string };
}

export interface ReportMonth {
  month: string;
  timeZone: string;
  from: string;
  to: string;
}

export interface WeekPoint {
  startDay: string;
  endDay: string;
  assigned: number;
  completed: number;
}

export interface StaffReport {
  month: ReportMonth;
  person: { userId: string; name: string; role: Role; lastSeenAt: string | null };
  assigned: number;
  completed: number;
  onTime: number;
  late: number;
  avgDaysToComplete: number | null;
  openNow: number;
  overdueNow: number;
  weeks: WeekPoint[];
}

export interface ClientReport {
  month: ReportMonth;
  client: { clientId: string; name: string; ownerId: string; ownerName: string };
  events: { total: number; byState: Record<EventState, number>; byType: Record<EventType, number> };
  stageMoves: number;
  comments: {
    received: number;
    solved: number;
    replied: number;
    avgFirstReplyHours: number | null;
    byStatus: ClientCommentStatusCounts;
  };
  todos: { done: number; open: number };
  assetsAdded: number;
}

/** All HTTP calls the Reports module makes against hok-api (Admin only). */
export const reportsApi = {
  /** Who is working or idle: server-side search, role, status and paging. */
  teamStatus(params: { search?: string; role?: Role; status?: TeamStatus; limit: number; offset: number }): Promise<TeamStatusPage> {
    const q = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
    if (params.search) q.set("search", params.search);
    if (params.role) q.set("role", params.role);
    if (params.status) q.set("status", params.status);
    return apiFetch(`/reports/team-status?${q.toString()}`);
  },

  staff(userId: string, month: string): Promise<StaffReport> {
    return apiFetch(`/reports/staff?${new URLSearchParams({ userId, month }).toString()}`);
  },

  client(clientId: string, month: string): Promise<ClientReport> {
    return apiFetch(`/reports/client?${new URLSearchParams({ clientId, month }).toString()}`);
  },
};
