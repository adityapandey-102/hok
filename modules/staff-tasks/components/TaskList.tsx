"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type StaffTaskSummary } from "../../../lib/domain";
import { staffTasksApi, type StaffTaskListFilters } from "../api/staffTasksApi";
import { DueChip, PRIORITY_ACCENT, PersonDot, PriorityPill, TaskStatusPill, roleLabel } from "./taskUi";
import { Pager } from "../../../components/ui/Pager";
import { Icon } from "../../../components/ui/Icon";
import { EmptyState } from "../../../components/ui/EmptyState";

export const TASK_PAGE_SIZE = 20;

/**
 * Server-paged task list (FR-TSK-08/09). Overdue rows get a red edge and an
 * "Overdue" pill. `filters` is already the API query; the page lives in the
 * parent, whose filter handlers reset it to the first page. Stale responses are ignored.
 */
export function TaskList({
  filters,
  filterKey,
  zone,
  showAssignee,
  reloadKey,
  filtered,
  page,
  onPageChange,
}: {
  filters: StaffTaskListFilters;
  filterKey: string;
  zone: string;
  showAssignee: boolean;
  reloadKey: number;
  filtered: boolean;
  page: number;
  onPageChange: (page: number) => void;
}) {
  const [tasks, setTasks] = useState<StaffTaskSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      setLoading(true);
      staffTasksApi
        .list({ ...filters, limit: TASK_PAGE_SIZE, offset: page * TASK_PAGE_SIZE })
        .then((data) => {
          if (cancelled) return;
          setTasks(data.tasks);
          setTotal(data.total);
          setError(null);
        })
        .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load tasks"))
        .finally(() => !cancelled && setLoading(false));
    };
    run();
    return () => {
      cancelled = true;
    };
    // filterKey stands for `filters` (a fresh object each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, page, reloadKey, retry]);

  return (
    <div className="overflow-hidden rounded-app-lg border border-border bg-card shadow-app">
      {loading ? (
        <ul className="divide-y divide-border-light" aria-busy="true" aria-label="Loading tasks">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-5 py-4">
              <div className="skeleton h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3.5 w-2/3 rounded-app-sm" />
                <div className="skeleton h-3 w-1/3 rounded-app-sm" />
              </div>
              <div className="skeleton hidden h-6 w-20 rounded-app-sm sm:block" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 p-6 text-sm text-error">
          <span>{error}</span>
          <button onClick={() => setRetry((k) => k + 1)} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState icon="clipboard" title={filtered ? "No tasks match your filters." : "No tasks yet."} description={filtered ? "Try a different filter." : "Tasks the Admin assigns will show up here."} />
      ) : (
        <ul className="divide-y divide-border-light">
          {tasks.map((t, i) => (
            <li key={t.id}>
              <Link
                href={`/app/tasks/${t.id}`}
                style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                className="group animate-fade-in relative flex items-center gap-3 py-3.5 pr-4 pl-5 transition-colors hover:bg-accent-bg sm:gap-4 sm:pr-5"
              >
                <span aria-hidden className={`absolute inset-y-2.5 left-0 w-[3px] rounded-r-full ${PRIORITY_ACCENT[t.priority]}`} />
                <PersonDot name={t.assigneeName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="line-clamp-2 text-[14px] font-semibold text-text-primary sm:truncate">{t.title}</span>
                    {t.hasEditorBrief && <Icon name="file" size={13} className="shrink-0 text-text-muted" />}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-text-muted">
                    {[showAssignee ? `${t.assigneeName} · ${roleLabel(t.assigneeRole)}` : null, t.clientName].filter(Boolean).join(" · ") || "No client"}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:hidden">
                    <TaskStatusPill status={t.status} />
                    <PriorityPill priority={t.priority} />
                    <DueChip dueAt={t.dueAt} status={t.status} zone={zone} />
                  </div>
                </div>
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  <DueChip dueAt={t.dueAt} status={t.status} zone={zone} />
                  <PriorityPill priority={t.priority} />
                  <span className="w-24 text-right">
                    <TaskStatusPill status={t.status} />
                  </span>
                </div>
                <Icon name="chevron-right" size={15} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && <Pager page={page} pageSize={TASK_PAGE_SIZE} total={total} onPageChange={onPageChange} />}
    </div>
  );
}
