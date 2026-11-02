"use client";

import { useId, useRef, useState } from "react";
import {
  TODO_REMINDER_TEXT,
  TODO_URGENCIES,
  TODO_URGENCY_LABELS,
  buildTodoPayload,
  isoToZonedInput,
  todoFormSchema,
  type Todo,
  type TodoFormValues,
} from "../../../lib/domain";
import { todosApi } from "../api/todosApi";
import { describeTodoError } from "./todoUi";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Select, Textarea } from "../../../components/ui/Select";
import { Icon } from "../../../components/ui/Icon";

function initialValues(todo: Todo | undefined, zone: string, defaultDue: string, defaultTitle: string): TodoFormValues {
  return {
    title: todo?.title ?? defaultTitle,
    notes: todo?.notes ?? "",
    urgency: todo?.urgency ?? "medium",
    due: todo ? (todo.dueAt ? isoToZonedInput(todo.dueAt, zone) : "") : defaultDue,
  };
}

/**
 * Add / edit a to-do in a modal (notes, due date and time, urgency). The due
 * time is typed in the viewer's own zone. `defaultDue` ("YYYY-MM-DDTHH:mm")
 * prefills a new to-do, e.g. 17:00 on the calendar day it was added from.
 * The parent mounts it only while open, so each opening starts fresh.
 */
export function TodoFormModal({
  todo,
  zone,
  defaultDue = "",
  defaultTitle = "",
  onClose,
  onSaved,
  onDelete,
}: {
  /** Present = edit. */
  todo?: Todo;
  zone: string;
  defaultDue?: string;
  defaultTitle?: string;
  onClose: () => void;
  onSaved: (todo: Todo, created: boolean) => void;
  onDelete?: (todo: Todo) => void;
}) {
  const titleId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const editing = !!todo;
  const [v, setV] = useState<TodoFormValues>(() => initialValues(todo, zone, defaultDue, defaultTitle));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof TodoFormValues>(k: K, value: TodoFormValues[K]) => setV((s) => ({ ...s, [k]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = todoFormSchema.safeParse(v);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = buildTodoPayload(v, zone, editing);
      if (todo) {
        const { todo: saved } = await todosApi.update(todo.id, { ...payload, version: todo.version });
        onSaved(saved, false);
      } else {
        const { todo: saved } = await todosApi.create(payload);
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
            <FieldLabel required htmlFor="td-title">
              Title
            </FieldLabel>
            <Input id="td-title" ref={titleRef} value={v.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
            <FieldError>{errors.title}</FieldError>
          </div>

          <div>
            <FieldLabel htmlFor="td-due">Due ({zone})</FieldLabel>
            <Input id="td-due" type="datetime-local" value={v.due} onChange={(e) => set("due", e.target.value)} />
            <FieldError>{errors.due}</FieldError>
          </div>
          <div>
            <FieldLabel htmlFor="td-urgency">Urgency</FieldLabel>
            <Select id="td-urgency" value={v.urgency} onChange={(e) => set("urgency", e.target.value as TodoFormValues["urgency"])}>
              {TODO_URGENCIES.map((u) => (
                <option key={u} value={u}>
                  {TODO_URGENCY_LABELS[u]}
                </option>
              ))}
            </Select>
          </div>
          <p className="-mt-2 text-xs text-text-muted sm:col-span-2">
            Reminders: {TODO_REMINDER_TEXT[v.urgency]}
            {v.urgency !== "low" && !v.due ? " (once you set a due time)" : ""}.
          </p>

          <div className="sm:col-span-2">
            <FieldLabel htmlFor="td-notes">Notes</FieldLabel>
            <Textarea id="td-notes" rows={3} maxLength={2000} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
            <FieldError>{errors.notes}</FieldError>
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
            <Button type="button" variant="outline" className="ml-auto text-error" onClick={() => onDelete(todo)} aria-label={`Delete ${todo.title}`}>
              <Icon name="trash" size={16} /> Delete
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
