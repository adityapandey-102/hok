"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STAFF_TASK_STATUSES, STAFF_TASK_STATUS_LABELS, isTaskOverdue, type StaffTaskStatus, type StaffTaskSummary } from "../../../lib/domain";
import { staffTasksApi, type StaffTaskListFilters } from "../api/staffTasksApi";
import { DueChip, PRIORITY_ACCENT, PersonDot, PriorityPill, StageChip } from "./taskUi";

/** Cards per column. Each column is its own server query (`status=X`), capped. */
const COLUMN_LIMIT = 50;

interface Column {
  tasks: StaffTaskSummary[];
  total: number;
}

/**
 * The board for the Admin and the client managers (FR-TSK-09): one column per
 * status, each loaded from the server with the active filters. Since round 2 a
 * task's status follows its stage, so cards are no longer dragged between
 * columns: open the card and move the task through its stages there. Each card
 * shows the current stage ("Rough cut · 2/5"). Columns scroll sideways on phones.
 */
export function TaskBoard({
  filters,
  filterKey,
  zone,
  reloadKey,
}: {
  filters: StaffTaskListFilters;
  filterKey: string;
  zone: string;
  reloadKey: number;
}) {
  const [columns, setColumns] = useState<Record<StaffTaskStatus, Column> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all(STAFF_TASK_STATUSES.map((status) => staffTasksApi.list({ ...filters, status, limit: COLUMN_LIMIT, offset: 0 })))
      .then((pages) => {
        if (cancelled) return;
        const next = {} as Record<StaffTaskStatus, Column>;
        STAFF_TASK_STATUSES.forEach((s, i) => (next[s] = { tasks: pages[i]!.tasks, total: pages[i]!.total }));
        setColumns(next);
        setError(null);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load the board"));
    return () => {
      cancelled = true;
    };
    // filterKey stands for `filters`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, reloadKey, refresh]);

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-app-lg border border-border bg-card p-6 text-sm text-error shadow-app">
        <span>{error}</span>
        <button onClick={() => setRefresh((k) => k + 1)} className="font-medium underline">
          Retry
        </button>
      </div>
    );
  }
  if (!columns)
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Loading tasks">
        {STAFF_TASK_STATUSES.map((s) => (
          <div key={s} className="skeleton h-64 rounded-app-lg" />
        ))}
      </div>
    );

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
      {STAFF_TASK_STATUSES.map((status) => (
        <BoardColumn key={status} status={status} column={columns[status]} zone={zone} />
      ))}
    </div>
  );
}

const COLUMN_DOT: Record<StaffTaskStatus, string> = {
  todo: "bg-accent",
  in_progress: "bg-info",
  blocked: "bg-warning",
  done: "bg-success",
};

function BoardColumn({ status, column, zone }: { status: StaffTaskStatus; column: Column; zone: string }) {
  return (
    <section
      aria-label={`${STAFF_TASK_STATUS_LABELS[status]} column`}
      className="flex w-[82%] shrink-0 snap-start flex-col rounded-app-lg border border-border-light bg-accent-bg p-2.5 sm:w-[45%] lg:w-auto"
    >
      <header className="mb-2.5 flex items-center gap-2 px-1.5 pt-1">
        <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${COLUMN_DOT[status]}`} />
        <h2 className="font-serif text-[15px] text-text-primary">{STAFF_TASK_STATUS_LABELS[status]}</h2>
        <span className="figure ml-auto rounded-full bg-card px-2 py-0.5 text-xs text-text-secondary ring-1 ring-border ring-inset">{column.total}</span>
      </header>
      <ul className="flex min-h-24 flex-col gap-2.5">
        {column.tasks.map((t) => (
          <BoardCard key={t.id} task={t} zone={zone} />
        ))}
        {column.tasks.length === 0 && <li className="rounded-app border border-dashed border-accent-light p-4 text-center text-xs text-text-muted">Nothing here</li>}
      </ul>
      {column.total > column.tasks.length && (
        <p className="mt-2 px-1 text-xs text-text-muted">
          Showing {column.tasks.length} of {column.total}. Use the list view or filters to see the rest.
        </p>
      )}
    </section>
  );
}

function BoardCard({ task, zone }: { task: StaffTaskSummary; zone: string }) {
  const overdue = isTaskOverdue(task);
  return (
    <li className={`lift relative overflow-hidden rounded-app border bg-card py-3 pr-3 pl-4 shadow-app ${overdue ? "border-error/40" : "border-border"}`}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${PRIORITY_ACCENT[task.priority]}`} />
      <Link href={`/app/tasks/${task.id}`} className="block text-[13.5px] leading-snug font-semibold text-text-primary hover:underline">
        {task.title}
      </Link>
      {task.clientName && <div className="mt-1 truncate text-xs text-text-muted">{task.clientName}</div>}
      {task.status === "blocked" && task.blockedReason && <div className="mt-1 line-clamp-2 text-xs text-warning-text">Blocked: {task.blockedReason}</div>}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <StageChip stage={task.currentStage} count={task.stageCount} />
        <PriorityPill priority={task.priority} />
        <DueChip dueAt={task.dueAt} status={task.status} zone={zone} />
        <span className="ml-auto">
          <PersonDot name={task.assigneeName} size={24} />
        </span>
      </div>
    </li>
  );
}
