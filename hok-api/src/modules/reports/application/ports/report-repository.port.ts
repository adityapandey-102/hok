import type { Role } from "../../../../domain";
import type { ClientReport, MonthWeek, MonthWindow, StaffReport, TeamStatus } from "../../domain/report.entity";

export interface TeamStatusFilter {
  /** Name, case-insensitive. */
  search?: string;
  role?: Exclude<Role, "admin">;
  status?: TeamStatus;
}

/** A team row before the status rule is applied (the service applies it). */
export interface TeamStatusRowData {
  userId: string;
  name: string;
  role: Role;
  lastSeenAt: Date | null;
  openTasks: number;
  overdue: number;
  activityLast24h: number;
}

/** What the staff report's single aggregate query returns (figures only; the service shapes the response). */
export type StaffFigures = Omit<StaffReport, "month" | "person" | "weeks"> & { weeks: { assigned: number; completed: number }[] };
export type ClientFigures = Omit<ClientReport, "month" | "client">;

/**
 * Read-only aggregates for the Admin reports. Each method is a fixed number
 * of queries (named per method) whatever the data size.
 */
export interface ReportRepositoryPort {
  /** One page of active non-admin staff with their task counts and 24 h activity. One query. */
  teamStatus(filter: TeamStatusFilter, since: Date, now: Date, limit: number, offset: number): Promise<TeamStatusRowData[]>;
  /** How many staff match the filter (same rule, same windows). One query. */
  teamStatusCount(filter: TeamStatusFilter, since: Date, now: Date): Promise<number>;
  /** The person, or null when there's no such account. One query. */
  person(userId: string): Promise<{ userId: string; name: string; role: Role; lastSeenAt: Date | null } | null>;
  /** One person's task figures for the month and its weeks. One query. */
  staffFigures(userId: string, month: MonthWindow, weeks: MonthWeek[], now: Date): Promise<StaffFigures>;
  /** The client and its owner, or null. One query. */
  client(clientId: string): Promise<{ clientId: string; name: string; ownerId: string; ownerName: string } | null>;
  /** One client's figures for the month. Five queries in parallel (events, stage moves, comments, to-dos, assets). */
  clientFigures(clientId: string, month: MonthWindow): Promise<ClientFigures>;
}
