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
  today: DashboardEvent[];
  upcoming: DashboardEvent[];
  byStage: StageGroup[];
  unresolvedComments: { received: number; inProgress: number };
  latestComments: DashboardComment[];
}

export interface FirmSection {
  totals: { clients: number; activeEvents: number; openTasks: number; unresolvedComments: number };
  tasksByStatus: TaskStatusCounts;
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

/** All HTTP calls the Dashboard module makes against hok-api. */
export const dashboardApi = {
  get(): Promise<Dashboard> {
    return apiFetch("/dashboard");
  },
};
