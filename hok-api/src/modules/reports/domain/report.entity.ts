import type { Role } from "../../../domain";
import type { CommentStatus } from "../../client-comments/domain/client-comment.entity";
import type { EventState, EventType } from "../../events/domain/event.entity";

/**
 * Admin reports (REQUIREMENTS FR-RPT-01..04). Read-only SQL aggregates over
 * other modules' tables; the query count is fixed whatever the data size.
 * Months are calendar months in the VIEWER's time zone; instants are UTC.
 */

/** Team status page size: default and cap. */
export const TEAM_STATUS_PAGE_DEFAULT = 20;
export const TEAM_STATUS_PAGE_MAX = 50;

/** How many months back a staff / client report may look, the current month included. */
export const REPORT_MONTHS = 6;

/** The "working" rule: open tasks AND (seen OR acted) within this many hours. */
export const WORKING_WINDOW_HOURS = 24;

export const TEAM_STATUSES = ["working", "idle"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

export interface TeamStatusRow {
  userId: string;
  name: string;
  role: Role;
  lastSeenAt: string | null;
  openTasks: number;
  overdue: number;
  /** Their task updates + stage moves + audit actions in the window. */
  activityLast24h: number;
  status: TeamStatus;
}

export interface TeamStatusPage {
  members: TeamStatusRow[];
  total: number;
  limit: number;
  offset: number;
  /** The rule's window, so the screen can explain it. */
  rule: { windowHours: number; asOf: string };
}

/** A month in the viewer's zone: [from, to) as UTC instants. */
export interface MonthWindow {
  month: string;
  timeZone: string;
  from: string;
  to: string;
}

/** A week of the month (Monday-start, clipped to the month): [from, to) plus its first and last calendar day. */
export interface MonthWeek {
  startDay: string;
  endDay: string;
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
  month: MonthWindow;
  person: { userId: string; name: string; role: Role; lastSeenAt: string | null };
  assigned: number;
  completed: number;
  onTime: number;
  late: number;
  /** Mean days from creation to completion, for tasks completed in the month; null when none. */
  avgDaysToComplete: number | null;
  openNow: number;
  overdueNow: number;
  weeks: WeekPoint[];
}

export interface ClientReport {
  month: MonthWindow;
  client: { clientId: string; name: string; ownerId: string; ownerName: string };
  events: {
    total: number;
    byState: Record<EventState, number>;
    byType: Record<EventType, number>;
  };
  stageMoves: number;
  comments: {
    received: number;
    solved: number;
    /** How many received comments have a reply. */
    replied: number;
    /** Mean hours from posting to first reply, for the replied ones; null when none. */
    avgFirstReplyHours: number | null;
    byStatus: Record<CommentStatus, number>;
  };
  todos: { done: number; open: number };
  assetsAdded: number;
}
