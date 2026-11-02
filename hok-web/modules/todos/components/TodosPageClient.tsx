"use client";

import { useEffect, useState } from "react";
import { type Todo } from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { todosApi } from "../api/todosApi";
import { TodoFormModal } from "./TodoFormModal";
import { TickBox, TodoDue, UrgencyPill, describeTodoError } from "./todoUi";
import { Button } from "../../../components/ui/Button";
import { Segmented } from "../../../components/ui/Segmented";
import { Icon } from "../../../components/ui/Icon";
import { Input } from "../../../components/ui/Field";
import { Pager } from "../../../components/ui/Pager";
import { Panel } from "../../../components/ui/Panel";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";

export const TODO_PAGE_SIZE = 50;
type Tab = "open" | "done";
const TABS: { id: Tab; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
];

/** Left accent per urgency: urgent crimson, high amber, the rest a quiet hairline. */
const ACCENT: Record<Todo["urgency"], string> = { low: "bg-border", medium: "bg-border", high: "bg-warning", urgent: "bg-primary" };

/**
 * /app/todos: the caller's own, private to-do list. Open / Done, a quick-add
 * title box ("More" opens the full form), a tick box per row, edit and delete.
 * Server-paged (50 a page) with the shared Pager; stale responses are ignored.
 */
export function TodosPageClient({ zone }: { zone: string }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("open");
  const [page, setPage] = useState(0);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [quick, setQuick] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ todo?: Todo; title?: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      setLoading(true);
      todosApi
        .list({ status: tab, limit: TODO_PAGE_SIZE, offset: page * TODO_PAGE_SIZE })
        .then((data) => {
          if (cancelled) return;
          setTodos(data.todos);
          setTotal(data.total);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load your to-dos");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [tab, page, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    setAdding(true);
    try {
      await todosApi.create({ title });
      setQuick("");
      showToast("To-do added.", "success");
      setTab("open");
      setPage(0);
      reload();
    } catch (err) {
      showToast(describeTodoError(err, "Failed to add the to-do"), "error");
    } finally {
      setAdding(false);
    }
  }

  async function toggleDone(t: Todo) {
    setBusyId(t.id);
    try {
      await todosApi.setDone(t, !t.done);
      // A to-do that leaves this list on the last row of a page would leave an empty page.
      if (todos.length === 1 && page > 0) setPage(page - 1);
      reload();
    } catch (err) {
      if (isApiErrorCode(err, "TODO_MODIFIED") || isApiErrorCode(err, "TODO_NOT_FOUND")) {
        showToast("This to-do was changed elsewhere. The list was refreshed.", "error");
        reload();
      } else {
        showToast(describeTodoError(err, "Failed to update the to-do"), "error");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(t: Todo) {
    const ok = await confirm({ title: `Delete "${t.title}"?`, body: "The to-do is removed for good.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await todosApi.remove(t.id);
      setForm(null);
      showToast("To-do deleted.", "success");
      if (todos.length === 1 && page > 0) setPage(page - 1);
      reload();
    } catch (err) {
      showToast(describeTodoError(err, "Failed to delete the to-do"), "error");
      if (isApiErrorCode(err, "TODO_NOT_FOUND")) reload();
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <h1 className="page-title">To-dos</h1>
        <p className="text-sm text-text-muted">
          Private to you. Reminders follow urgency: urgent 1 day, 1 hour and at the due time; high 1 hour and at due; medium at due; low none.
        </p>
      </header>

      <form onSubmit={quickAdd} className="mb-4 flex flex-col gap-2 sm:flex-row" aria-label="Add a to-do">
        <Input
          className="sm:flex-1"
          placeholder="Add a to-do…"
          aria-label="New to-do title"
          maxLength={200}
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button type="submit" disabled={adding || !quick.trim()}>
            <Icon name="plus" size={16} /> Add
          </Button>
          <Button type="button" variant="outline" onClick={() => setForm({ title: quick.trim() })}>
            More
          </Button>
        </div>
      </form>

      <Panel
        title={tab === "open" ? "Open" : "Done"}
        subtitle={loading || error ? undefined : `${total.toLocaleString("en-IN")} ${tab === "open" ? "to do, soonest due first" : "finished, newest first"}`}
        action={
          <Segmented
            label="Show"
            options={TABS}
            value={tab}
            onChange={(id) => {
              setTab(id);
              setPage(0);
            }}
          />
        }
      >
        {loading ? (
          <ul className="divide-y divide-border-light" aria-busy="true" aria-label="Loading to-dos">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-4 sm:px-5">
                <div className="skeleton h-6 w-6 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/5 rounded" />
                  <div className="skeleton h-3 w-2/5 rounded" />
                </div>
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="flex items-center justify-between gap-3 p-6 text-sm text-error">
            <span>{error}</span>
            <button onClick={reload} className="font-medium underline">
              Retry
            </button>
          </div>
        ) : todos.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title={tab === "open" ? "All caught up." : "Nothing done yet."}
            description={tab === "open" ? "Add a to-do above, or from any day on your calendar." : "To-dos you tick off show up here."}
          />
        ) : (
          <ul className="divide-y divide-border-light" data-testid="todo-list">
            {todos.map((t) => (
              <li key={t.id} className="group relative flex items-start gap-1 py-1.5 pr-2 pl-2 transition-colors hover:bg-accent-bg">
                <span aria-hidden className={`absolute inset-y-2.5 left-0 w-[3px] rounded-r-full ${t.done ? "bg-border" : ACCENT[t.urgency]}`} />
                <TickBox
                  done={t.done}
                  busy={busyId === t.id}
                  label={t.done ? `Reopen ${t.title}` : `Mark ${t.title} done`}
                  onToggle={() => void toggleDone(t)}
                />
                <button type="button" onClick={() => setForm({ todo: t })} aria-label={`Edit ${t.title}`} className="min-w-0 flex-1 rounded-app-sm py-2 text-left">
                  <span className={`block text-[14px] font-semibold break-words text-text-primary ${t.done ? "line-through decoration-text-muted opacity-70" : ""}`}>{t.title}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <UrgencyPill urgency={t.urgency} />
                    <TodoDue dueAt={t.dueAt} done={t.done} zone={zone} />
                  </span>
                  {t.notes && <span className="mt-1.5 line-clamp-2 block text-xs break-words text-text-secondary">{t.notes}</span>}
                </button>
                <span className="flex shrink-0 items-center self-center">
                  <button
                    type="button"
                    onClick={() => setForm({ todo: t })}
                    aria-label={`Edit details of ${t.title}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-card hover:text-text-primary max-sm:hidden"
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(t)}
                    aria-label={`Delete ${t.title}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-card hover:text-error"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && <Pager page={page} pageSize={TODO_PAGE_SIZE} total={total} onPageChange={setPage} />}
      </Panel>

      {form && (
        <TodoFormModal
          todo={form.todo}
          zone={zone}
          defaultTitle={form.title}
          onClose={() => setForm(null)}
          onDelete={remove}
          onSaved={(_saved, created) => {
            setForm(null);
            showToast(created ? "To-do added." : "To-do saved.", "success");
            if (created) {
              setQuick("");
              setTab("open");
              setPage(0);
            }
            reload();
          }}
        />
      )}
    </div>
  );
}
