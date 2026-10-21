/** Client to-dos (Phase 2, FR-CTSK-01..04). Mirror hok-api's client-todos module. Internal only; never on the portal. */
export const CLIENT_TODO_STATUSES = ["todo", "in_progress", "done"] as const;
export type ClientTodoStatus = (typeof CLIENT_TODO_STATUSES)[number];

export const CLIENT_TODO_STATUS_LABELS: Record<ClientTodoStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const CLIENT_TODO_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type ClientTodoPriority = (typeof CLIENT_TODO_PRIORITIES)[number];

export const CLIENT_TODO_PRIORITY_LABELS: Record<ClientTodoPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export interface ClientTodo {
  id: string;
  clientId: string;
  eventId: string | null;
  eventTitle: string | null;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: ClientTodoPriority;
  status: ClientTodoStatus;
  completedAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
