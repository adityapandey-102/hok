"use client";

import { useEffect, useMemo, useState } from "react";
import { CLIENT_TODO_PRIORITIES, CLIENT_TODO_PRIORITY_LABELS, type ClientTodo, type ClientTodoPriority } from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { clientTodosApi } from "../api/clientTodosApi";
import { hasTodoFilters, toTodoApiFilters, type TodoDueFilter, type TodoTab } from "./todoFilters";
import { ClientTodoFormModal } from "./ClientTodoFormModal";
import { TODO_PRIORITY_ACCENT, describeTodoError } from "./todoUi";
import { DueChip, PriorityPill } from "../../staff-tasks/components/taskUi";
import { Button } from "../../../components/ui/Button";
import { Segmented } from "../../../components/ui/Segmented";
import { Icon } from "../../../components/ui/Icon";
import { Input } from "../../../components/ui/Field";
import { Select } from "../../../components/ui/Select";
import { Pager } from "../../../components/ui/Pager";
import { StatusPill } from "../../../components/ui/StatusPill";
import { Panel } from "../../../components/ui/Panel";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";

const PAGE_SIZE = 20;
const TABS: { id: TodoTab; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "done", label: "Done" },
  { id: "all", label: "All" },
];
const DUE_OPTIONS: { value: TodoDueFilter; label: string }[] = [
  { value: "", label: "Any due date" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Due this week" },
];

function doneOn(iso: string, zone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: zone, day: "numeric", month: "short" }).format(new Date(iso));
}

/**
 * A client's to-do list (FR-CTSK-01..04): the client workspace's To-dos tab.
 * Server-paged with Open / Done / All tabs, priority and due filters (the
 * viewer's days) and a debounced title search. The round checkbox marks a
 * to-do done (or reopens it); clicking the row edits it. Read-only on an
 * archived client. Internal only: the portal never shows these.
 */
export function ClientTodosPanel({ clientId, readOnly = false, viewerTimeZone }: { clientId: string; readOnly?: boolean; viewerTimeZone: string }) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [todos, setTodos] = useState<ClientTodo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<TodoTab>("open");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const [priority, setPriority] = useState<ClientTodoPriority | "">("");
  const [due, setDue] = useState<TodoDueFilter>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<{ todo?: ClientTodo } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const state = useMemo(() => ({ tab, search: debouncedSearch, priority, due }), [tab, debouncedSearch, priority, due]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      setLoading(true);
      clientTodosApi
        .list(clientId, { ...toTodoApiFilters(state, viewerTimeZone), limit: PAGE_SIZE, offset: page * PAGE_SIZE })
        .then((data) => {
          if (cancelled) return;
          setTodos(data.todos);
          setTotal(data.total);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load to-dos");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [clientId, state, viewerTimeZone, page, reloadKey]);

  const filtered = hasTodoFilters({ ...state, search });
  const reload = () => setReloadKey((k) => k + 1);

  async function toggleDone(t: ClientTodo) {
    setBusyId(t.id);
    try {
      await clientTodosApi.setDone(t, t.status !== "done");
      // A to-do that leaves this tab's list on the last row of a page would leave an empty page.
      if (todos.length === 1 && page > 0 && tab !== "all") setPage(page - 1);
      reload();
    } catch (err) {
      if (isApiErrorCode(err, "CLIENT_TODO_MODIFIED") || isApiErrorCode(err, "CLIENT_TODO_NOT_FOUND")) {
        showToast("Someone else changed this to-do. The list was refreshed.", "error");
        reload();
      } else {
        showToast(describeTodoError(err, "Failed to update the to-do"), "error");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(t: ClientTodo) {
    const ok = await confirm({ title: `Delete "${t.title}"?`, body: "The to-do is removed for good.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await clientTodosApi.remove(t.id, t.version);
      setForm(null);
      showToast("To-do deleted.", "success");
      if (todos.length === 1 && page > 0) setPage(page - 1);
      reload();
    } catch (err) {
      if (isApiErrorCode(err, "CLIENT_TODO_MODIFIED") || isApiErrorCode(err, "CLIENT_TODO_NOT_FOUND")) {
        setForm(null);
        showToast("Someone else changed this to-do. The list was refreshed.", "error");
        reload();
      } else {
        showToast(describeTodoError(err, "Failed to delete the to-do"), "error");
      }
    }
  }

  const subtitle =
    loading || error ? "Your internal to-dos for this client" : `${total.toLocaleString("en-IN")} ${tab === "open" ? "open" : tab === "done" ? "done" : "in total"}, soonest due first`;

  return (
    <Panel
      icon="clipboard"
      title="To-dos"
      subtitle={subtitle}
      action={
        !readOnly ? (
          <Button className="max-sm:hidden" onClick={() => setForm({})}>
            <Icon name="plus" size={16} /> New to-do
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2 border-b border-border-light px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
        <Segmented
          label="Show"
          options={TABS}
          value={tab}
          onChange={(id) => {
            setTab(id);
            setPage(0);
          }}
          className="self-start max-sm:w-full"
          stretch
        />
        <Input
          className="sm:max-w-xs sm:flex-1"
          placeholder="Search to-dos"
          aria-label="Search to-dos"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <Select
            className="sm:w-auto"
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value as ClientTodoPriority | "");
              setPage(0);
            }}
          >
            <option value="">All priorities</option>
            {CLIENT_TODO_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {CLIENT_TODO_PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
          <Select
            className="sm:w-auto"
            aria-label="Filter by due date"
            value={due}
            onChange={(e) => {
              setDue(e.target.value as TodoDueFilter);
              setPage(0);
            }}
          >
            {DUE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        {!readOnly && (
          <Button className="sm:hidden" onClick={() => setForm({})}>
            <Icon name="plus" size={16} /> New to-do
          </Button>
        )}
      </div>

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
          icon="clipboard"
          title={filtered ? "No to-dos match these filters." : tab === "done" ? "Nothing done yet." : tab === "all" ? "No to-dos yet." : readOnly ? "No open to-dos." : "All caught up."}
          description={filtered ? "Try a different filter." : !readOnly && tab !== "done" ? "Add a to-do for this client." : undefined}
        />
      ) : (
        <ul className="divide-y divide-border-light">
          {todos.map((t, i) => {
            const isDone = t.status === "done";
            return (
              <li
                key={t.id}
                style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
                className="animate-fade-in group relative flex items-start gap-1 py-1.5 pr-4 pl-2 transition-colors hover:bg-accent-bg sm:pr-5"
              >
                <span aria-hidden className={`absolute inset-y-2.5 left-0 w-[3px] rounded-r-full ${isDone ? "bg-border" : TODO_PRIORITY_ACCENT[t.priority]}`} />
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isDone}
                  aria-label={isDone ? `Reopen ${t.title}` : `Mark ${t.title} done`}
                  disabled={readOnly || busyId === t.id}
                  onClick={() => toggleDone(t)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:cursor-default"
                >
                  <span
                    className={`flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-colors ${
                      isDone ? "border-success bg-success text-white" : "border-text-muted/60 bg-card text-transparent group-hover:border-text-primary"
                    }`}
                  >
                    <Icon name="check" size={13} />
                  </span>
                </button>
                {readOnly ? (
                  <TodoBody t={t} zone={viewerTimeZone} />
                ) : (
                  <button type="button" onClick={() => setForm({ todo: t })} aria-label={`Edit ${t.title}`} className="min-w-0 flex-1 rounded-app-sm py-2 text-left">
                    <TodoBody t={t} zone={viewerTimeZone} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!loading && !error && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}

      {form && (
        <ClientTodoFormModal
          clientId={clientId}
          todo={form.todo}
          zone={viewerTimeZone}
          onClose={() => setForm(null)}
          onDelete={remove}
          onSaved={(_saved, created) => {
            setForm(null);
            showToast(created ? "To-do added." : "To-do saved.", "success");
            if (created) setPage(0);
            reload();
          }}
        />
      )}
    </Panel>
  );
}

function TodoBody({ t, zone }: { t: ClientTodo; zone: string }) {
  const isDone = t.status === "done";
  return (
    <div className={`min-w-0 flex-1 py-2 ${isDone ? "opacity-70" : ""}`}>
      <span className={`block text-[14px] font-semibold break-words text-text-primary ${isDone ? "line-through decoration-text-muted" : ""}`}>{t.title}</span>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {t.status === "in_progress" && <StatusPill label="In progress" tone="blue" />}
        <PriorityPill priority={t.priority} />
        {isDone && t.completedAt ? (
          <span className="inline-flex items-center gap-1 text-xs text-text-muted">
            <Icon name="check-circle" size={12} /> Done {doneOn(t.completedAt, zone)}
          </span>
        ) : (
          <DueChip dueAt={t.dueAt} status={t.status} zone={zone} />
        )}
        {t.eventTitle && (
          <span className="inline-flex max-w-full min-w-0 items-center gap-1 text-xs text-text-muted">
            <Icon name="calendar" size={12} className="shrink-0" />
            <span className="truncate">{t.eventTitle}</span>
          </span>
        )}
      </div>
      {t.description && <p className="mt-1.5 line-clamp-2 text-xs break-words text-text-secondary">{t.description}</p>}
    </div>
  );
}
