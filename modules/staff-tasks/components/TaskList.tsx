"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { isTaskOverdue, type StaffTaskSummary } from "../../../lib/domain";
import { staffTasksApi, type StaffTaskListFilters } from "../api/staffTasksApi";
import { DueLabel, PriorityPill, TaskStatusPill, roleLabel } from "./taskUi";
import { Pager } from "../../../components/ui/Pager";
import { Icon } from "../../../components/ui/Icon";

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
        <div className="p-6 text-sm text-text-muted">Loading…</div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 p-6 text-sm text-error">
          <span>{error}</span>
          <button onClick={() => setRetry((k) => k + 1)} className="font-medium underline">
            Retry
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-6 text-sm text-text-muted">{filtered ? "No tasks match your filters." : "No tasks yet."}</div>
      ) : (
        <ul className="divide-y divide-border-light">
          {tasks.map((t, i) => {
            const overdue = isTaskOverdue(t);
            return (
              <li key={t.id}>
                <Link
                  href={`/app/tasks/${t.id}`}
                  style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                  className={`group animate-fade-in flex items-start gap-3 border-l-4 p-4 transition-colors hover:bg-primary-bg/30 ${overdue ? "border-l-error" : "border-l-transparent"}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-text-primary">{t.title}</span>
                      {t.hasEditorBrief && (
                        <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                          <Icon name="file" size={12} /> Brief
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                      {showAssignee && (
                        <span>
                          {t.assigneeName} · {roleLabel(t.assigneeRole)}
                        </span>
                      )}
                      {t.clientName && <span>{t.clientName}</span>}
                      <DueLabel dueAt={t.dueAt} status={t.status} zone={zone} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <TaskStatusPill status={t.status} />
                    <PriorityPill priority={t.priority} />
                  </div>
                  <Icon name="chevron-right" size={14} className="mt-1 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {!loading && !error && <Pager page={page} pageSize={TASK_PAGE_SIZE} total={total} onPageChange={onPageChange} />}
    </div>
  );
}
