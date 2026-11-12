"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { dayRange, formatDayLabel, formatTimeInZone, itemsOnDay, itemsStartingOnDay, type DayKey, type Todo } from "../../../lib/domain";
import { untilLabel } from "./CalendarChip";
import { isApiErrorCode } from "../../../lib/api/client";
import { todosApi } from "../../todos/api/todosApi";
import { TickBox, UrgencyPill, describeTodoError } from "../../todos/components/todoUi";
import { PriorityPill, StageChip, TaskStatusPill } from "../../staff-tasks/components/taskUi";
import { TYPE_CHIP_CLASSES, countByKind, type CalendarItem } from "../calendarItems";
import { Modal } from "../../../components/ui/Modal";
import { Button, ButtonLink } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { useToast } from "../../../components/ui/Toast";

/** What the viewer may start from a day (each button shows only when allowed). */
export interface DayActions {
  /** Link target for "New event"; absent = not allowed. */
  newEventHref?: string;
  onNewTask?: () => void;
  onNewTodo?: () => void;
  onNewPersonal?: () => void;
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="px-5 py-3">
      <h3 className="mb-1.5 text-[13px] font-semibold text-text-secondary">
        {title} <span className="font-normal text-text-muted">{count}</span>
      </h3>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </section>
  );
}

/**
 * The day pop-up (round 1): everything on one day in the viewer's zone, split
 * into Events, Tasks, To-dos and Personal, plus the create buttons the viewer
 * is allowed. To-dos tick off right here. The calendar feed carries no
 * version for a to-do, so the day's to-dos are fetched once (GET /todos for
 * this day, at most 100) to tick or edit them.
 */
export function DayModal({
  day,
  items,
  zone,
  actions,
  onClose,
  onOpenPersonal,
  onEditTodo,
  onChanged,
}: {
  day: DayKey;
  /** The visible feed; the modal picks out this day. */
  items: CalendarItem[];
  zone: string;
  actions: DayActions;
  onClose: () => void;
  onOpenPersonal: (id: string) => void;
  onEditTodo: (todo: Todo) => void;
  /** A to-do was ticked: the feed behind the pop-up reloads. */
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  // What starts today is listed by kind; multi-day events that started earlier sit under "Ongoing".
  const dayItems = useMemo(() => itemsStartingOnDay(items, day, zone), [items, day, zone]);
  const ongoing = useMemo(
    () => itemsOnDay(items, day, zone).filter((i) => i.kind === "event" && !dayItems.includes(i)),
    [items, day, zone, dayItems],
  );
  const by = (kind: CalendarItem["kind"]) => dayItems.filter((i) => i.kind === kind);
  const events = by("event");
  const tasks = by("task");
  const todos = by("todo");
  const personal = by("personal");
  const todoCount = countByKind(dayItems).todo;

  // The day's full to-dos (with versions) for ticking and editing.
  const [full, setFull] = useState<Record<string, Todo>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fullKey, setFullKey] = useState(0);
  useEffect(() => {
    if (todoCount === 0) return;
    let cancelled = false;
    const { from, to } = dayRange(day, day, zone);
    todosApi
      .list({ status: "all", dueFrom: from, dueTo: to, limit: 100 })
      .then((res) => {
        if (!cancelled) setFull(Object.fromEntries(res.todos.map((t) => [t.id, t])));
      })
      .catch(() => {
        // Ticking stays off; the list itself still shows from the feed.
      });
    return () => {
      cancelled = true;
    };
  }, [day, zone, todoCount, fullKey]);

  async function toggle(item: CalendarItem) {
    const t = full[item.id];
    if (!t) return;
    setBusyId(item.id);
    try {
      await todosApi.setDone(t, !t.done);
      setFullKey((k) => k + 1);
      onChanged();
    } catch (err) {
      if (isApiErrorCode(err, "TODO_MODIFIED") || isApiErrorCode(err, "TODO_NOT_FOUND")) {
        showToast("This to-do was changed elsewhere. The day was refreshed.", "error");
        setFullKey((k) => k + 1);
        onChanged();
      } else {
        showToast(describeTodoError(err, "Failed to update the to-do"), "error");
      }
    } finally {
      setBusyId(null);
    }
  }

  const time = (it: CalendarItem) => formatTimeInZone(it.startsAt, zone);
  const hasAction = !!(actions.newEventHref || actions.onNewTask || actions.onNewTodo || actions.onNewPersonal);

  return (
    <Modal open onClose={onClose} labelledBy="day-modal-h" panelClassName="max-h-[92vh] sm:max-w-lg">
      <div className="flex min-h-0 flex-1 flex-col" data-testid="day-modal" data-day={day}>
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <h2 id="day-modal-h" className="font-serif text-lg text-text-primary">
            {formatDayLabel(day)}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-app-sm p-1 text-text-muted hover:bg-accent-bg">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 divide-y divide-border-light overflow-y-auto">
          {dayItems.length === 0 && ongoing.length === 0 && <p className="px-5 py-6 text-sm text-text-muted">Nothing on this day.</p>}

          {events.length > 0 && (
            <Section title="Events" count={events.length}>
              {events.map((it) => (
                <li key={it.id}>
                  <Link
                    href={it.href}
                    data-testid="day-item"
                    className={`flex items-center gap-2 rounded-app-sm border px-2.5 py-2 text-sm transition-colors hover:border-text-secondary ${TYPE_CHIP_CLASSES[it.type]} ${it.state !== "active" ? "line-through opacity-60" : ""}`}
                  >
                    <span className="w-16 shrink-0 text-xs font-semibold">{time(it)}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{it.title}</span>
                    {untilLabel(it, zone) && <span className="shrink-0 text-xs text-text-muted">{untilLabel(it, zone)}</span>}
                    {it.clientName && <span className="max-w-[40%] shrink truncate text-xs text-text-muted">{it.clientName}</span>}
                  </Link>
                </li>
              ))}
            </Section>
          )}

          {ongoing.length > 0 && (
            <Section title="Ongoing" count={ongoing.length}>
              {ongoing.map((it) => (
                <li key={it.id}>
                  <Link
                    href={it.href}
                    data-testid="day-item"
                    className={`flex items-center gap-2 rounded-app-sm border px-2.5 py-2 text-sm transition-colors hover:border-text-secondary ${TYPE_CHIP_CLASSES[it.type]} ${it.state !== "active" ? "line-through opacity-60" : ""}`}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{it.title}</span>
                    <span className="shrink-0 text-xs text-text-muted">{untilLabel(it, zone)}</span>
                    {it.clientName && <span className="max-w-[40%] shrink truncate text-xs text-text-muted">{it.clientName}</span>}
                  </Link>
                </li>
              ))}
            </Section>
          )}

          {tasks.length > 0 && (
            <Section title="Tasks" count={tasks.length}>
              {tasks.map((it) => (
                <li key={it.id}>
                  <Link
                    href={it.href}
                    data-testid="day-item"
                    className={`block rounded-app-sm border px-2.5 py-2 text-sm transition-colors hover:border-text-secondary ${TYPE_CHIP_CLASSES.task}`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{it.title}</span>
                      <span className="shrink-0 text-xs text-text-muted">{time(it)}</span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {it.taskStatus && <TaskStatusPill status={it.taskStatus} />}
                      {it.stageName && it.taskStageNumber && it.taskStageCount && <StageChip stage={{ name: it.stageName, position: it.taskStageNumber }} count={it.taskStageCount} />}
                      {it.stageName && !(it.taskStageNumber && it.taskStageCount) && <span className="text-xs text-text-muted">{it.stageName}</span>}
                      {it.taskPriority && <PriorityPill priority={it.taskPriority} />}
                      {it.assigneeName && <span className="text-xs text-text-muted">{it.assigneeName}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </Section>
          )}

          {todos.length > 0 && (
            <Section title="To-dos" count={todos.length}>
              {todos.map((it) => (
                <li key={it.id} data-testid="day-item" data-kind="todo" className={`flex items-center gap-0.5 rounded-app-sm border pr-2.5 pl-0.5 ${TYPE_CHIP_CLASSES.todo}`}>
                  <TickBox
                    done={it.done}
                    busy={busyId === it.id || !full[it.id]}
                    label={it.done ? `Reopen ${it.title}` : `Mark ${it.title} done`}
                    onToggle={() => void toggle(it)}
                  />
                  <button
                    type="button"
                    disabled={!full[it.id]}
                    onClick={() => full[it.id] && onEditTodo(full[it.id])}
                    aria-label={`Edit ${it.title}`}
                    className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-sm disabled:cursor-default"
                  >
                    <span className={`min-w-0 flex-1 truncate font-medium text-text-primary ${it.done ? "line-through opacity-60" : ""}`}>{it.title}</span>
                    {it.urgency && <UrgencyPill urgency={it.urgency} />}
                    <span className="shrink-0 text-xs text-text-muted">{time(it)}</span>
                  </button>
                </li>
              ))}
            </Section>
          )}

          {personal.length > 0 && (
            <Section title="Personal" count={personal.length}>
              {personal.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    data-testid="day-item"
                    onClick={() => onOpenPersonal(it.id)}
                    className={`flex w-full items-center gap-2 rounded-app-sm border px-2.5 py-2 text-left text-sm transition-colors hover:border-text-secondary ${TYPE_CHIP_CLASSES.personal}`}
                  >
                    <span className="w-16 shrink-0 text-xs font-semibold">{time(it)}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{it.title}</span>
                    {it.clientName && <span className="max-w-[40%] shrink truncate text-xs text-text-muted">{it.clientName}</span>}
                  </button>
                </li>
              ))}
            </Section>
          )}
        </div>

        {hasAction && (
          <div className="grid grid-cols-2 gap-2 border-t border-border-light px-5 py-4 sm:flex sm:flex-wrap">
            {actions.newEventHref && (
              <ButtonLink href={actions.newEventHref} variant="outline">
                <Icon name="plus" size={15} /> New event
              </ButtonLink>
            )}
            {actions.onNewTask && (
              <Button variant="outline" onClick={actions.onNewTask}>
                <Icon name="plus" size={15} /> New task
              </Button>
            )}
            {actions.onNewTodo && (
              <Button variant="outline" onClick={actions.onNewTodo}>
                <Icon name="plus" size={15} /> New to-do
              </Button>
            )}
            {actions.onNewPersonal && (
              <Button variant="outline" onClick={actions.onNewPersonal}>
                <Icon name="plus" size={15} /> New personal entry
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
