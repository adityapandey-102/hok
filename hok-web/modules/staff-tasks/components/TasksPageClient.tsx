"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ROLES,
  ROLE_LABELS,
  hasCapability,
  STAFF_TASK_PRIORITIES,
  STAFF_TASK_PRIORITY_LABELS,
  STAFF_TASK_STATUSES,
  STAFF_TASK_STATUS_LABELS,
  type Role,
  type StaffTaskPriority,
} from "../../../lib/domain";
import type { TaskRelation } from "../api/staffTasksApi";
import { teamMembersApi } from "../../team-members/api/teamMembersApi";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { usersApi } from "../../admin-users/api/usersApi";
import { EMPTY_FILTERS, toApiFilters, type DueFilter, type TaskFilterState } from "./taskFilters";
import { TaskList } from "./TaskList";
import { TaskBoard } from "./TaskBoard";
import { TaskFormModal } from "./TaskFormModal";
import { Button } from "../../../components/ui/Button";
import { Segmented } from "../../../components/ui/Segmented";
import { FilterToggle } from "../../../components/ui/FilterToggle";
import { Icon } from "../../../components/ui/Icon";
import { Input } from "../../../components/ui/Field";
import { Select } from "../../../components/ui/Select";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { useToast } from "../../../components/ui/Toast";

type View = "list" | "board";
const VIEW_KEY = "hok.tasks.view";

const RELATIONS: { id: "all" | TaskRelation; label: string }[] = [
  { id: "all", label: "All" },
  { id: "assigned", label: "Assigned to me" },
  { id: "created", label: "I assigned" },
  { id: "team", label: "My clients" },
];

/**
 * /app/tasks. Task-only staff see "My tasks" (FR-TSK-08): the tasks assigned to
 * them with status, priority and due filters, overdue highlighted. The Admin
 * (FR-TSK-09) sees every task. Client managers see the tasks assigned to them,
 * the ones they gave and their clients' tasks, with a segmented filter for the
 * three. Anyone who may assign (`staff_tasks:assign`: the Admin and the client
 * managers) also gets the assignee and role filters, list / Kanban, and "New task".
 */
export function TasksPageClient({
  role,
  viewerId,
  zone,
  initialFilters = {},
  initialAssigneeName,
}: {
  role: Role;
  viewerId: string;
  zone: string;
  /** From the URL (e.g. the dashboard's "View all overdue"). */
  initialFilters?: Partial<TaskFilterState>;
  initialAssigneeName?: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const isAdmin = role === "admin";
  // Admin and the client managers: create, board, assignee filter. The API decides who may do what to each task.
  const canAssign = hasCapability(role, "staff_tasks:assign");
  const isManager = canAssign && !isAdmin;
  const [filters, setFilters] = useState<TaskFilterState>(() => ({ ...EMPTY_FILTERS, ...initialFilters }));
  const debouncedSearch = useDebouncedValue(filters.search.trim(), SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(0);
  const [view, setView] = useState<View>("list");
  const [formOpen, setFormOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Remember the Admin's view per browser (a convenience; falls back to the list).
  useEffect(() => {
    if (!canAssign) return;
    // Read after mount (never during render), so the server and first client render agree.
    const restore = () => {
      try {
        if (window.localStorage.getItem(VIEW_KEY) === "board") setView("board");
      } catch {
        // Storage blocked: keep the default.
      }
    };
    restore();
  }, [canAssign]);

  function chooseView(next: View) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // ignore
    }
  }

  /** Every filter change goes back to page 1 in the same handler. */
  function update<K extends keyof TaskFilterState>(key: K, value: TaskFilterState[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  }

  const effective = { ...filters, search: debouncedSearch };
  const board = canAssign && view === "board";
  const apiFilters = toApiFilters(effective, zone, board);
  const filterKey = JSON.stringify(apiFilters);
  const filtered = JSON.stringify({ ...filters, search: filters.search.trim() }) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className={`mx-auto ${board ? "max-w-7xl" : "max-w-5xl"}`}>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">{canAssign ? "Tasks" : "My tasks"}</h1>
          <p className="text-sm text-text-muted">
            {isAdmin ? "Every task you've assigned to the team." : isManager ? "Tasks assigned to you, tasks you've given, and your clients' tasks." : "Tasks assigned to you."}
          </p>
        </div>
        {canAssign && (
          <div className="page-actions items-center">
            <Segmented
              label="View"
              value={view}
              onChange={chooseView}
              options={[
                { id: "list", label: "List", icon: "list" },
                { id: "board", label: "Board", icon: "columns" },
              ]}
              className="max-sm:w-full"
              stretch
            />
            <Button onClick={() => setFormOpen(true)}>
              <Icon name="plus" size={16} /> New task
            </Button>
          </div>
        )}
      </header>

      {isManager && (
        <Segmented
          label="Which tasks"
          options={RELATIONS}
          value={filters.relation || "all"}
          onChange={(id) => update("relation", id === "all" ? "" : id)}
          className="mb-3 self-start max-sm:w-full"
          stretch
        />
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <div className="relative sm:col-span-2">
          <Icon name="search" size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
          <Input
            className="pl-9"
            placeholder="Search by title"
            aria-label="Search tasks"
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
          />
        </div>
        <FilterToggle active={[!board && filters.status !== "open", filters.priority, filters.due, filters.assigneeId, filters.role].filter(Boolean).length}>
        {!board && (
          <Select aria-label="Filter by status" value={filters.status} onChange={(e) => update("status", e.target.value as TaskFilterState["status"])}>
            <option value="open">Open tasks</option>
            <option value="all">All statuses</option>
            {STAFF_TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STAFF_TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        )}
        <Select aria-label="Filter by priority" value={filters.priority} onChange={(e) => update("priority", e.target.value as StaffTaskPriority | "")}>
          <option value="">Any priority</option>
          {STAFF_TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {STAFF_TASK_PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by due date" value={filters.due} onChange={(e) => update("due", e.target.value as DueFilter)}>
          <option value="">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">Due in the next 7 days</option>
        </Select>
        {canAssign && (
          <>
            <SearchSelect
              aria-label="Filter by assignee"
              placeholder="Everyone"
              value={filters.assigneeId || null}
              selectedLabel={filters.assigneeId === initialFilters.assigneeId ? initialAssigneeName : undefined}
              clearable
              load={(q) => (isAdmin ? usersApi.searchOptions(q) : teamMembersApi.searchOptions(q))}
              onChange={(id) => update("assigneeId", id ?? "")}
            />
            <Select aria-label="Filter by role" value={filters.role} onChange={(e) => update("role", e.target.value as Role | "")}>
              <option value="">Any role</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </>
        )}
        </FilterToggle>
      </div>

      {board ? (
        <TaskBoard filters={apiFilters} filterKey={filterKey} zone={zone} reloadKey={reloadKey} isAdmin={isAdmin} viewerId={viewerId} />
      ) : (
        <TaskList
          filters={apiFilters}
          filterKey={filterKey}
          zone={zone}
          showAssignee={canAssign}
          reloadKey={reloadKey}
          filtered={filtered}
          page={page}
          onPageChange={setPage}
        />
      )}

      {canAssign && formOpen && (
        <TaskFormModal
          open
          zone={zone}
          onClose={() => setFormOpen(false)}
          onSaved={(task) => {
            setFormOpen(false);
            setReloadKey((k) => k + 1);
            showToast("Task created.", "success");
            router.push(`/app/tasks/${task.id}`);
          }}
        />
      )}
    </div>
  );
}
