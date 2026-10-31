import type { ClientTodo, ClientTodoPriority, ClientTodoStatus } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";

export interface ClientTodoListFilters {
  /** "all" = every status; omitted = open (not done). */
  status?: ClientTodoStatus | "all";
  priority?: ClientTodoPriority;
  overdue?: boolean;
  dueFrom?: string;
  dueTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ClientTodoListResult {
  todos: ClientTodo[];
  total: number;
  limit: number;
  offset: number;
}

/** Create/edit body (see lib/domain buildClientTodoPayload). `undefined` = omitted, `null` = clear. */
export interface ClientTodoPayload {
  title?: string;
  description?: string | null;
  priority?: ClientTodoPriority;
  status?: ClientTodoStatus;
  dueAt?: string | null;
  eventId?: string | null;
}

/** All HTTP calls the Client to-dos module makes against hok-api. */
export const clientTodosApi = {
  list(clientId: string, filters: ClientTodoListFilters = {}): Promise<ClientTodoListResult> {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === "" || value === false) continue;
      q.set(key, String(value));
    }
    return apiFetch(`/clients/${clientId}/todos?${q.toString()}`);
  },

  create(clientId: string, payload: ClientTodoPayload): Promise<{ todo: ClientTodo }> {
    return apiFetch(`/clients/${clientId}/todos`, { method: "POST", body: JSON.stringify(payload) });
  },

  update(id: string, payload: ClientTodoPayload & { version: number }): Promise<{ todo: ClientTodo }> {
    return apiFetch(`/client-todos/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  /** Quick toggle from the list: done, or reopened to "to do". */
  setDone(todo: Pick<ClientTodo, "id" | "version">, done: boolean): Promise<{ todo: ClientTodo }> {
    return apiFetch(`/client-todos/${todo.id}`, { method: "PATCH", body: JSON.stringify({ status: done ? "done" : "todo", version: todo.version }) });
  },

  remove(id: string, version: number): Promise<null> {
    return apiFetch(`/client-todos/${id}?version=${version}`, { method: "DELETE" });
  },
};
