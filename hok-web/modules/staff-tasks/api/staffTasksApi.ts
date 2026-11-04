import type { Role, StaffTask, StaffTaskPriority, StaffTaskStatus, StaffTaskSummary, TaskLinkKind, WorkParentRef } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";

export type TaskRelation = "assigned" | "created" | "team";

export interface StaffTaskListFilters {
  status?: StaffTaskStatus;
  open?: boolean;
  priority?: StaffTaskPriority;
  assigneeId?: string;
  role?: Role;
  clientId?: string;
  /** Narrow to one relation to the caller: given to me, created by me, or via my client teams (managers). */
  relation?: TaskRelation;
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
  brief?: string | null;
  assigneeId?: string;
  priority?: StaffTaskPriority;
  dueAt?: string | null;
  clientId?: string | null;
  eventId?: string | null;
  /** Create only. */
  templateId?: string;
  /** Create only: brief links. */
  links?: { url: string; label?: string }[];
  /** Create only (round 4): make the new task a part of a stage of an event or another task. */
  parent?: WorkParentRef;
}

/** All HTTP calls the Staff Tasks module makes against hok-api. Every write returns the fresh task. */
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

  /** Move to any stage (forward or back). */
  moveStage(id: string, stageId: string, version: number, comment?: string): Promise<{ task: StaffTask }> {
    return apiFetch(`/staff-tasks/${id}/stage`, { method: "POST", body: JSON.stringify({ version, stageId, comment: comment || undefined }) });
  },

  /** Finish the task; only from the last stage. */
  complete(id: string, version: number, comment?: string): Promise<{ task: StaffTask }> {
    return apiFetch(`/staff-tasks/${id}/stage`, { method: "POST", body: JSON.stringify({ version, complete: true, comment: comment || undefined }) });
  },

  block(id: string, reason: string, version: number): Promise<{ task: StaffTask }> {
    return apiFetch(`/staff-tasks/${id}/block`, { method: "POST", body: JSON.stringify({ version, reason }) });
  },

  unblock(id: string, version: number, comment?: string): Promise<{ task: StaffTask }> {
    return apiFetch(`/staff-tasks/${id}/unblock`, { method: "POST", body: JSON.stringify({ version, comment: comment || undefined }) });
  },

  /** Only from Done. `stageId` omitted = the last stage. */
  reopen(id: string, version: number, stageId?: string, comment?: string): Promise<{ task: StaffTask }> {
    return apiFetch(`/staff-tasks/${id}/reopen`, { method: "POST", body: JSON.stringify({ version, stageId, comment: comment || undefined }) });
  },

  comment(id: string, body: string): Promise<{ task: StaffTask }> {
    return apiFetch(`/staff-tasks/${id}/comments`, { method: "POST", body: JSON.stringify({ body }) });
  },

  addLink(id: string, link: { kind: TaskLinkKind; url: string; label?: string; stageId?: string }): Promise<{ task: StaffTask }> {
    return apiFetch(`/staff-tasks/${id}/links`, { method: "POST", body: JSON.stringify(link) });
  },

  removeLink(id: string, linkId: string): Promise<{ task: StaffTask }> {
    return apiFetch(`/staff-tasks/${id}/links/${linkId}`, { method: "DELETE" });
  },

  /** Turn a delivered link into a client-visible asset on the task's event. */
  shareLink(id: string, linkId: string, body: { title?: string; stageId?: string }): Promise<{ task: StaffTask; assetId: string }> {
    return apiFetch(`/staff-tasks/${id}/links/${linkId}/share`, { method: "POST", body: JSON.stringify(body) });
  },
};
