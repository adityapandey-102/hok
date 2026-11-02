import type { Todo, TodoUrgency } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";

export interface TodoListFilters {
  /** Omitted = open. */
  status?: "open" | "done" | "all";
  dueFrom?: string;
  dueTo?: string;
  limit?: number;
  offset?: number;
}

export interface TodoListResult {
  todos: Todo[];
  total: number;
  limit: number;
  offset: number;
}

/** Create/edit body (see lib/domain buildTodoPayload). `undefined` = omitted, `null` = clear. */
export interface TodoPayload {
  title?: string;
  notes?: string | null;
  dueAt?: string | null;
  urgency?: TodoUrgency;
  done?: boolean;
}

/** All HTTP calls the My to-dos module makes against hok-api. Always the caller's own to-dos. */
export const todosApi = {
  list(filters: TodoListFilters = {}): Promise<TodoListResult> {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === "") continue;
      q.set(key, String(value));
    }
    return apiFetch(`/todos?${q.toString()}`);
  },

  create(payload: TodoPayload): Promise<{ todo: Todo }> {
    return apiFetch("/todos", { method: "POST", body: JSON.stringify(payload) });
  },

  update(id: string, payload: TodoPayload & { version: number }): Promise<{ todo: Todo }> {
    return apiFetch(`/todos/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  /** Tick or untick from a list. */
  setDone(todo: Pick<Todo, "id" | "version">, done: boolean): Promise<{ todo: Todo }> {
    return apiFetch(`/todos/${todo.id}`, { method: "PATCH", body: JSON.stringify({ done, version: todo.version }) });
  },

  remove(id: string): Promise<null> {
    return apiFetch(`/todos/${id}`, { method: "DELETE" });
  },
};
