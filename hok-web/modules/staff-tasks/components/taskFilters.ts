import { addDays, dayRange, todayKey, type Role, type StaffTaskPriority, type StaffTaskStatus } from "../../../lib/domain";
import type { StaffTaskListFilters, TaskRelation } from "../api/staffTasksApi";

export type DueFilter = "" | "overdue" | "today" | "week";

/** What the filter bar holds. `status` "open" = everything but done (the default), "all" = every status. */
export interface TaskFilterState {
  search: string;
  status: "open" | "all" | StaffTaskStatus;
  priority: StaffTaskPriority | "";
  due: DueFilter;
  /** Admin and client managers. */
  assigneeId: string;
  role: Role | "";
  /** Client managers' tabs: given to me, created by me, via my clients. "" = all of them. */
  relation: TaskRelation | "";
}

export const EMPTY_FILTERS: TaskFilterState = { search: "", status: "open", priority: "", due: "", assigneeId: "", role: "", relation: "" };

/**
 * Filter bar -> API query. "Due today" / "this week" are the VIEWER's days
 * (their profile zone), sent as instant ranges, so the server never guesses a zone.
 * The board ignores `status` (each column is one status).
 */
export function toApiFilters(f: TaskFilterState, zone: string, forBoard = false): StaffTaskListFilters {
  const out: StaffTaskListFilters = {
    search: f.search.trim() || undefined,
    priority: f.priority || undefined,
    assigneeId: f.assigneeId || undefined,
    role: f.role || undefined,
    relation: f.relation || undefined,
  };
  if (!forBoard) {
    if (f.status === "open") out.open = true;
    else if (f.status !== "all") out.status = f.status;
  }
  if (f.due === "overdue") out.overdue = true;
  if (f.due === "today" || f.due === "week") {
    const today = todayKey(zone);
    const range = dayRange(today, f.due === "today" ? today : addDays(today, 6), zone);
    out.dueFrom = range.from;
    out.dueTo = range.to;
  }
  return out;
}
