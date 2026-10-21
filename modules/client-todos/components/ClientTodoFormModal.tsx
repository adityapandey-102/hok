"use client";

import { useId, useRef, useState } from "react";
import {
  CLIENT_TODO_PRIORITIES,
  CLIENT_TODO_PRIORITY_LABELS,
  CLIENT_TODO_STATUSES,
  CLIENT_TODO_STATUS_LABELS,
  buildClientTodoPayload,
  clientTodoFormSchema,
  isoToZonedInput,
  type ClientTodo,
  type ClientTodoFormValues,
} from "../../../lib/domain";
import { clientTodosApi } from "../api/clientTodosApi";
import { eventsApi } from "../../events/api/eventsApi";
import { describeTodoError } from "./todoUi";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Select, Textarea } from "../../../components/ui/Select";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { Icon } from "../../../components/ui/Icon";

function initialValues(todo: ClientTodo | undefined, zone: string): ClientTodoFormValues {
  return {
    title: todo?.title ?? "",
    description: todo?.description ?? "",
    priority: todo?.priority ?? "medium",
    status: todo?.status ?? "todo",
    due: todo?.dueAt ? isoToZonedInput(todo.dueAt, zone) : "",
    eventId: todo?.eventId ?? "",
  };
}

/**
 * Add / edit a client to-do (FR-CTSK-01/02) in a modal. The due date is typed
 * in the viewer's own time zone. The event picker searches the client's own
 * events. Editing also offers the status and a delete. The parent mounts it
 * only while open, so each opening starts from fresh state.
 */
export function ClientTodoFormModal({
  clientId,
  todo,
  zone,
  onClose,
  onSaved,
  onDelete,
}: {
  clientId: string;
  /** Present = edit. */
  todo?: ClientTodo;
  zone: string;
  onClose: () => void;
  onSaved: (todo: ClientTodo, created: boolean) => void;
  onDelete?: (todo: ClientTodo) => void;
}) {
  const titleId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const editing = !!todo;
  const [v, setV] = useState<ClientTodoFormValues>(() => initialValues(todo, zone));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof ClientTodoFormValues>(k: K, value: ClientTodoFormValues[K]) => setV((s) => ({ ...s, [k]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = clientTodoFormSchema.safeParse(v);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = buildClientTodoPayload(v, zone, editing);
      if (todo) {
        const { todo: saved } = await clientTodosApi.update(todo.id, { ...payload, version: todo.version });
        onSaved(saved, false);
      } else {
        const { todo: saved } = await clientTodosApi.create(clientId, payload);
        onSaved(saved, true);
      }
    } catch (err) {
      setFormError(describeTodoError(err, "Failed to save the to-do"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy={titleId} initialFocusRef={titleRef} panelClassName="max-h-[92vh] sm:max-w-xl">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col" noValidate>
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <h2 id={titleId} className="font-serif text-lg text-text-primary">
            {editing ? "Edit to-do" : "New to-do"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-app-sm p-1 text-text-muted hover:bg-accent-bg">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel required htmlFor="ctd-title">
              Title
            </FieldLabel>
            <Input id="ctd-title" ref={titleRef} value={v.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
            <FieldError>{errors.title}</FieldError>
          </div>

          <div>
            <FieldLabel htmlFor="ctd-priority">Priority</FieldLabel>
            <Select id="ctd-priority" value={v.priority} onChange={(e) => set("priority", e.target.value as ClientTodoFormValues["priority"])}>
              {CLIENT_TODO_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {CLIENT_TODO_PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="ctd-due">Due ({zone})</FieldLabel>
            <Input id="ctd-due" type="datetime-local" value={v.due} onChange={(e) => set("due", e.target.value)} />
            <FieldError>{errors.due}</FieldError>
          </div>

          {editing && (
            <div>
              <FieldLabel htmlFor="ctd-status">Status</FieldLabel>
              <Select id="ctd-status" value={v.status} onChange={(e) => set("status", e.target.value as ClientTodoFormValues["status"])}>
                {CLIENT_TODO_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CLIENT_TODO_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className={editing ? "" : "sm:col-span-2"}>
            <FieldLabel htmlFor="ctd-event">Event (optional)</FieldLabel>
            <SearchSelect
              id="ctd-event"
              placeholder="No event"
              emptyText="No events"
              value={v.eventId || null}
              selectedLabel={todo?.eventTitle ?? undefined}
              clearable
              loadKey={clientId}
              load={(q) => eventsApi.searchOptions(clientId, q)}
              onChange={(id) => set("eventId", id ?? "")}
            />
          </div>

          <div className="sm:col-span-2">
            <FieldLabel htmlFor="ctd-description">Description</FieldLabel>
            <Textarea id="ctd-description" rows={3} maxLength={2000} value={v.description} onChange={(e) => set("description", e.target.value)} />
            <FieldError>{errors.description}</FieldError>
          </div>

          {formError && (
            <p role="alert" className="text-sm text-error sm:col-span-2">
              {formError}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border-light px-5 py-4">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add to-do"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {todo && onDelete && (
            <Button type="button" variant="outline" className="ml-auto" onClick={() => onDelete(todo)} aria-label={`Delete ${todo.title}`}>
              <Icon name="trash" size={16} /> Delete
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
