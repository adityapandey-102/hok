import type { ReferenceLink, Role, StaffTask, StaffTaskPriority, StaffTaskStatus, StaffTaskSummary } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";

export interface StaffTaskListFilters {
  status?: StaffTaskStatus;
  open?: boolean;
  priority?: StaffTaskPriority;
  /** Admin only (ignored by the API for everyone else). */
  assigneeId?: string;
  role?: Role;
  overdue?: boolean;
  dueFrom?: string;
  dueTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface StaffTaskListResult {
  tasks: StaffTaskSummary[];
  total: number;
  limit: number;
  offset: number;
}

/** Create/edit body (see lib/domain buildStaffTaskPayload). `undefined` = omitted, `null` = clear. */
export interface StaffTaskPayload {
  title?: string;
  description?: string | null;
  assigneeId?: string;
  priority?: StaffTaskPriority;
  dueAt?: string | null;
  clientId?: string | null;
  eventId?: string | null;
  rawFilesUrl?: string | null;
  referenceUrl?: string | null;
  script?: string | null;
  referenceLinks?: ReferenceLink[];
}

/** All HTTP calls the Staff Tasks module makes against hok-api. */
export const staffTasksApi = {
  list(filters: StaffTaskListFilters = {}): Promise<StaffTaskListResult> {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === "" || value === false) continue;
      q.set(key, String(value));
    }
    return apiFetch(`/staff-tasks?${q.toString()}`);
  },

  get(id: string): Promise<{ task: StaffTask }> {
    return apiFetch(`/staff-tasks/${id}`);
  },

  create(payload: StaffTaskPayload): Promise<{ task: StaffTask }> {
    return apiFetch("/staff-tasks", { method: "POST", body: JSON.stringify(payload) });
  },

  update(id: string, payload: StaffTaskPayload & { version: number }): Promise<{ task: StaffTask }> {
    return apiFetch(`/staff-tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  remove(id: string): Promise<null> {
    return apiFetch(`/staff-tasks/${id}`, { method: "DELETE" });
  },

  changeStatus(id: string, status: StaffTaskStatus, version: number, comment?: string): Promise<{ task: StaffTask }> {
    return apiFetch(`/staff-tasks/${id}/status`, { method: "POST", body: JSON.stringify({ status, version, comment: comment || undefined }) });
  },

  reopen(id: string, status: Exclude<StaffTaskStatus, "done">, version: number, comment?: string): Promise<{ task: StaffTask }> {
    return apiFetch(`/staff-tasks/${id}/reopen`, { method: "POST", body: JSON.stringify({ status, version, comment: comment || undefined }) });
  },

  comment(id: string, body: string): Promise<{ task: StaffTask }> {
    return apiFetch(`/staff-tasks/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) });
  },

  /** The task form's event picker (Admin): one client's events, newest first, capped at 100. */
  async listClientEvents(clientId: string): Promise<{ id: string; title: string; startsAt: string }[]> {
    const data = (await apiFetch(`/events?clientId=${clientId}&limit=100`)) as { events: { id: string; title: string; startsAt: string }[] };
    return data.events;
  },
};
