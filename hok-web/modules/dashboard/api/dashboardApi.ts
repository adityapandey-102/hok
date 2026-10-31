import type { Role } from "../../../lib/domain";
import type { CommentStatus } from "../../client-comments/lib/commentStatus";
import type { EventState, EventType, StaffTaskPriority, StaffTaskStatus } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";

/** Wire shape of GET /dashboard (mirrors hok-api's dashboard.entity.ts). */
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
  assigneeName: string | null;
}

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
  doneThisWeek: number;
  /** Last time they used HOK; null = never. */
  lastSeenAt: string | null;
}

export interface TasksSection {
  counts: TaskStatusCounts;
  dueToday: number;
  overdue: number;
  open: DashboardTask[];
  recentComments: DashboardTaskComment[];
}

export interface ClientsSection {
  clientCount: number;
  /** All events overlapping this week (the lists are capped at 5). */
  weekEventCount: number;
  today: DashboardEvent[];
  upcoming: DashboardEvent[];
  byStage: StageGroup[];
  unresolvedComments: { received: number; inProgress: number };
  latestComments: DashboardComment[];
}

export interface FirmSection {
  totals: {
    clients: number;
    activeEvents: number;
    openTasks: number;
    overdueTasks: number;
    unresolvedComments: number;
    weekEvents: number;
    teamSize: number;
  };
  tasksByStatus: TaskStatusCounts;
  week: DashboardEvent[];
  overdueTasks: DashboardTask[];
  latestComments: DashboardComment[];
  team: WorkloadRow[];
}

export type DashboardView = "overview" | "mine";

export interface Dashboard {
  role: Role;
  view: DashboardView;
  window: DashboardWindow;
  /** Null only on the Admin's overview (the firm replaces it). */
  tasks: TasksSection | null;
  clients: ClientsSection | null;
  firm: FirmSection | null;
}

export interface TeamWorkloadPage {
  members: WorkloadRow[];
  total: number;
  limit: number;
  offset: number;
}

/** All HTTP calls the Dashboard module makes against hok-api. */
export const dashboardApi = {
  /** `overview` (the landing page; the firm alone for the Admin) or `mine` (the Admin's "My clients"). */
  get(view: DashboardView = "overview"): Promise<Dashboard> {
    return apiFetch(view === "mine" ? "/dashboard?view=mine" : "/dashboard");
  },

  /** The whole team's workload (Admin): server-side name search, role filter and paging. */
  team(params: { search?: string; role?: Role; limit: number; offset: number }): Promise<TeamWorkloadPage> {
    const q = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
    if (params.search) q.set("search", params.search);
    if (params.role) q.set("role", params.role);
    return apiFetch(`/dashboard/team?${q.toString()}`);
  },
};
