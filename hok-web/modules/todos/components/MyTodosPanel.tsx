"use client";

import { useState } from "react";
import Link from "next/link";
import type { Todo, TodosSection } from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { todosApi } from "../api/todosApi";
import { TodoFormModal } from "./TodoFormModal";
import { TickBox, TodoDue, UrgencyPill, describeTodoError } from "./todoUi";
import { Panel } from "../../../components/ui/Panel";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Icon } from "../../../components/ui/Icon";
import { useToast } from "../../../components/ui/Toast";

/**
 * The dashboard's "My to-dos" card (every role): the open count with the
 * overdue part in the alert colour, the next five with a tick to finish them,
 * "Add" (opens the full form) and "View all". Private to the viewer, so it
 * never carries anyone else's. `onChanged` refreshes the dashboard quietly
 * (no skeleton) after a tick or an add.
 */
export function MyTodosPanel({ section, zone, onChanged }: { section: TodosSection; zone: string; onChanged: () => void }) {
  const { showToast } = useToast();
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Ticked rows show as done at once while the dashboard reloads behind them.
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());

  async function tick(t: Todo) {
    setBusyId(t.id);
    try {
      await todosApi.setDone(t, true);
      setTicked((s) => new Set(s).add(t.id));
      onChanged();
    } catch (err) {
      if (isApiErrorCode(err, "TODO_MODIFIED") || isApiErrorCode(err, "TODO_NOT_FOUND")) {
        showToast("This to-do was changed elsewhere. The list was refreshed.", "error");
        onChanged();
      } else {
        showToast(describeTodoError(err, "Failed to update the to-do"), "error");
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Panel
        title="My to-dos"
        subtitle={section.open === 0 ? "Nothing open" : `${section.open.toLocaleString("en-IN")} open`}
        footer={{ href: "/app/todos", label: "View all" }}
        action={
          <>
            {section.overdue > 0 && (
              <span className="text-[13px] font-semibold text-error" data-testid="todos-overdue">
                {section.overdue.toLocaleString("en-IN")} overdue
              </span>
            )}
            <Button variant="outline" className="min-h-9 px-3 py-1.5" onClick={() => setAdding(true)}>
              <Icon name="plus" size={15} /> Add
            </Button>
          </>
        }
      >
        {section.next.length === 0 ? (
          <EmptyState compact icon="check-circle" title="No open to-dos" description="Add one for whatever is on your mind." />
        ) : (
          <ul className="divide-y divide-border-light" data-testid="dashboard-todos">
            {section.next.map((t) => {
              const done = ticked.has(t.id);
              return (
                <li key={t.id} className="flex items-center gap-1 py-0.5 pr-4 pl-1.5 sm:pr-5">
                  <TickBox done={done} busy={busyId === t.id} label={`Mark ${t.title} done`} onToggle={() => void tick(t)} />
                  <Link href="/app/todos" className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-app-sm py-2.5 focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none">
                    <span className={`min-w-0 flex-1 basis-40 truncate text-[13.5px] font-medium text-text-primary ${done ? "line-through opacity-60" : ""}`}>{t.title}</span>
                    <span className="flex shrink-0 items-center gap-2.5">
                      <UrgencyPill urgency={t.urgency} />
                      <TodoDue dueAt={t.dueAt} done={done} zone={zone} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      {adding && (
        <TodoFormModal
          zone={zone}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            showToast("To-do added.", "success");
            onChanged();
          }}
        />
      )}
    </>
  );
}
