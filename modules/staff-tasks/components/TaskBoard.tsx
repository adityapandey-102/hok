"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { STAFF_TASK_STATUSES, STAFF_TASK_STATUS_LABELS, isTaskOverdue, type StaffTaskStatus, type StaffTaskSummary } from "../../../lib/domain";
import { staffTasksApi, type StaffTaskListFilters } from "../api/staffTasksApi";
import { DueLabel, PriorityPill, describeTaskError } from "./taskUi";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";

/** Cards per column. Each column is its own server query (`status=X`), capped. */
const COLUMN_LIMIT = 50;

interface Column {
  tasks: StaffTaskSummary[];
  total: number;
}

/**
 * The Admin's Kanban (FR-TSK-09): one column per status, each loaded from the
 * server with the active filters. Dragging a card to another column changes
 * its status after a confirm, with the card's version (a stale one reloads the
 * board); dragging out of Done reopens it. Columns scroll sideways on phones;
 * touch drags start after a short press so the page still scrolls.
 */
export function TaskBoard({ filters, filterKey, zone, reloadKey }: { filters: StaffTaskListFilters; filterKey: string; zone: string; reloadKey: number }) {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [columns, setColumns] = useState<Record<StaffTaskStatus, Column> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

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

  async function handleDragEnd(event: DragEndEvent) {
    const task = event.active.data.current?.task as StaffTaskSummary | undefined;
    const target = event.over?.id as StaffTaskStatus | undefined;
    if (!task || !target || target === task.status || busy) return;
    const reopening = task.status === "done";
    const ok = await confirm({
      title: reopening ? `Reopen "${task.title}"?` : `Move "${task.title}" to ${STAFF_TASK_STATUS_LABELS[target]}?`,
      body: reopening
        ? `It goes back to ${STAFF_TASK_STATUS_LABELS[target]} and ${task.assigneeName} can work on it again.`
        : `${task.assigneeName} will see the new status in the task's timeline.`,
      confirmLabel: reopening ? "Reopen" : "Move",
    });
    if (!ok) return;
    setBusy(true);
    try {
      if (reopening) await staffTasksApi.reopen(task.id, target as Exclude<StaffTaskStatus, "done">, task.version);
      else await staffTasksApi.changeStatus(task.id, target, task.version);
      showToast(reopening ? "Task reopened." : `Moved to ${STAFF_TASK_STATUS_LABELS[target]}.`, "success");
    } catch (err) {
      showToast(describeTaskError(err, "Failed to move the task"), "error");
    } finally {
      setBusy(false);
      setRefresh((k) => k + 1);
    }
  }

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
  if (!columns) return <div className="rounded-app-lg border border-border bg-card p-6 text-sm text-text-muted shadow-app">Loading…</div>;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
        {STAFF_TASK_STATUSES.map((status) => (
          <BoardColumn key={status} status={status} column={columns[status]} zone={zone} />
        ))}
      </div>
    </DndContext>
  );
}

function BoardColumn({ status, column, zone }: { status: StaffTaskStatus; column: Column; zone: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${STAFF_TASK_STATUS_LABELS[status]} column`}
      className={`flex w-[82%] shrink-0 snap-start flex-col rounded-app-lg border bg-app-bg/60 p-2.5 transition-colors sm:w-[45%] lg:w-auto ${
        isOver ? "border-primary/50 bg-primary-bg/40" : "border-border"
      }`}
    >
      <header className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-text-primary">{STAFF_TASK_STATUS_LABELS[status]}</h2>
        <span className="text-xs text-text-muted">{column.total}</span>
      </header>
      <ul className="flex min-h-24 flex-col gap-2">
        {column.tasks.map((t) => (
          <BoardCard key={t.id} task={t} zone={zone} />
        ))}
        {column.tasks.length === 0 && <li className="rounded-app border border-dashed border-border p-3 text-center text-xs text-text-muted">No tasks</li>}
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { task } });
  const overdue = isTaskOverdue(task);
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-manipulation rounded-app border bg-card p-3 shadow-app ${overdue ? "border-error/50" : "border-border"} ${
        isDragging ? "relative z-50 cursor-grabbing opacity-90 shadow-app-lg" : "cursor-grab"
      }`}
    >
      <Link href={`/app/tasks/${task.id}`} className="block text-sm font-semibold text-text-primary hover:underline">
        {task.title}
      </Link>
      <div className="mt-1 text-xs text-text-muted">
        {task.assigneeName}
        {task.clientName ? ` · ${task.clientName}` : ""}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PriorityPill priority={task.priority} />
        {task.status !== "done" && <DueLabel dueAt={task.dueAt} status={task.status} zone={zone} />}
      </div>
    </li>
  );
}
