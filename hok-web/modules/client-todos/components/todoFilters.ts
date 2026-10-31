import { addDays, dayRange, todayKey, type ClientTodoPriority } from "../../../lib/domain";
import type { ClientTodoListFilters } from "../api/clientTodosApi";

export type TodoTab = "open" | "done" | "all";
export type TodoDueFilter = "" | "overdue" | "today" | "week";

/** What the filter bar holds. */
export interface TodoFilterState {
  tab: TodoTab;
  search: string;
  priority: ClientTodoPriority | "";
  due: TodoDueFilter;
}

export const EMPTY_TODO_FILTERS: TodoFilterState = { tab: "open", search: "", priority: "", due: "" };

/**
 * Filter bar -> API query. "Due today" / "this week" are the VIEWER's days
 * (their profile zone), sent as instant ranges, so the server never guesses a zone.
 * The Open tab sends no status (the API's default is the open list).
 */
export function toTodoApiFilters(f: TodoFilterState, zone: string): ClientTodoListFilters {
  const out: ClientTodoListFilters = {
    search: f.search.trim() || undefined,
    priority: f.priority || undefined,
  };
  if (f.tab === "done") out.status = "done";
  else if (f.tab === "all") out.status = "all";
  if (f.due === "overdue") out.overdue = true;
  if (f.due === "today" || f.due === "week") {
    const today = todayKey(zone);
    const range = dayRange(today, f.due === "today" ? today : addDays(today, 6), zone);
    out.dueFrom = range.from;
    out.dueTo = range.to;
  }
  return out;
}

/** True when any narrowing filter (not the tab) is active. */
export function hasTodoFilters(f: TodoFilterState): boolean {
  return !!(f.search.trim() || f.priority || f.due);
}
