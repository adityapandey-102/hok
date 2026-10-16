"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  ROLE_LABELS,
  ROLES,
  STAFF_TASK_PRIORITIES,
  STAFF_TASK_PRIORITY_LABELS,
  buildStaffTaskPayload,
  formatInZone,
  isEditorRole,
  isoToZonedInput,
  staffTaskFormSchema,
  type StaffTask,
  type StaffTaskFormValues,
} from "../../../lib/domain";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import type { UserAccount } from "../../admin-users/api/usersApi";
import { clientsApi } from "../../clients/api/clientsApi";
import { staffTasksApi } from "../api/staffTasksApi";
import { describeTaskError } from "./taskUi";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Select, Textarea } from "../../../components/ui/Select";
import { Icon } from "../../../components/ui/Icon";

function initialValues(task?: StaffTask, zone?: string): StaffTaskFormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    assigneeId: task?.assigneeId ?? "",
    priority: task?.priority ?? "medium",
    due: task?.dueAt && zone ? isoToZonedInput(task.dueAt, zone) : "",
    clientId: task?.clientId ?? "",
    eventId: task?.eventId ?? "",
    rawFilesUrl: task?.rawFilesUrl ?? "",
    referenceUrl: task?.referenceUrl ?? "",
    script: task?.script ?? "",
    referenceLinks: (task?.referenceLinks ?? []).map((l) => l.url).join("\n"),
  };
}

/**
 * The Admin's create/edit form (FR-TSK-01/02/05/10) in a modal. Picking an
 * Editor shows the editor brief (raw files link required, reference link and
 * script optional); moving a task away from an editor warns that the brief
 * will be cleared. The due date is typed in the Admin's own time zone.
 * The parent mounts it only while open, so each opening starts from fresh state.
 */
export function TaskFormModal({
  open,
  task,
  assignees,
  zone,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Present = edit. */
  task?: StaffTask;
  /** Active staff (any role), loaded once by the page. */
  assignees: UserAccount[];
  zone: string;
  onClose: () => void;
  onSaved: (task: StaffTask) => void;
}) {
  const titleId = useId();
  const editing = !!task;
  const [v, setV] = useState<StaffTaskFormValues>(() => initialValues(task, zone));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof StaffTaskFormValues>(k: K, value: StaffTaskFormValues[K]) => setV((s) => ({ ...s, [k]: value }));

  const assignee = assignees.find((a) => a.id === v.assigneeId) ?? null;
  const role = assignee?.role ?? (task && v.assigneeId === task.assigneeId ? task.assigneeRole : null);
  const editor = isEditorRole(role);
  const losingBrief = editing && isEditorRole(task!.assigneeRole) && !!role && !editor;

  // -- client picker (debounced server search) + that client's events --------
  const [clientQuery, setClientQuery] = useState("");
  const debouncedClientQuery = useDebouncedValue(clientQuery.trim(), SEARCH_DEBOUNCE_MS);
  const [clientOptions, setClientOptions] = useState<{ id: string; businessName: string }[]>([]);
  const [clientName, setClientName] = useState<string | null>(task?.clientName ?? null);
  useEffect(() => {
    if (!open || !debouncedClientQuery) return;
    let cancelled = false;
    clientsApi
      .list({ search: debouncedClientQuery, limit: 8 })
      .then((r) => !cancelled && setClientOptions(r.clients.map((c) => ({ id: c.id, businessName: c.businessName }))))
      .catch(() => !cancelled && setClientOptions([]));
    return () => {
      cancelled = true;
    };
  }, [open, debouncedClientQuery]);

  const [loadedEvents, setLoadedEvents] = useState<{ clientId: string; list: { id: string; title: string; startsAt: string }[] } | null>(null);
  // Only the current client's events count; anything else is still loading (null).
  const events = loadedEvents && loadedEvents.clientId === v.clientId ? loadedEvents.list : null;
  // Results only while there's a query (an old result list never lingers).
  const shownClientOptions = debouncedClientQuery && clientQuery.trim() ? clientOptions : [];
  useEffect(() => {
    if (!open || !v.clientId) return;
    const clientId = v.clientId;
    let cancelled = false;
    staffTasksApi
      .listClientEvents(clientId)
      .then((list) => !cancelled && setLoadedEvents({ clientId, list }))
      // No event picker if events can't be loaded; the task still saves without one.
      .catch(() => !cancelled && setLoadedEvents({ clientId, list: [] }));
    return () => {
      cancelled = true;
    };
  }, [open, v.clientId]);

  const grouped = useMemo(
    () => ROLES.map((r) => ({ role: r, people: assignees.filter((a) => a.role === r) })).filter((g) => g.people.length > 0),
    [assignees],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = staffTaskFormSchema(role).safeParse(v);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = buildStaffTaskPayload(v, role, zone, editing);
      const { task: saved } = editing
        ? await staffTasksApi.update(task!.id, { ...payload, version: task!.version })
        : await staffTasksApi.create(payload);
      onSaved(saved);
    } catch (err) {
      setFormError(describeTaskError(err, "Failed to save the task"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} panelClassName="max-h-[92vh] sm:max-w-2xl">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <h2 id={titleId} className="font-serif text-lg text-text-primary">
            {editing ? "Edit task" : "New task"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-app-sm p-1 text-text-muted hover:bg-primary-bg">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel required htmlFor="tf-title">
              Title
            </FieldLabel>
            <Input id="tf-title" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={160} />
            <FieldError>{errors.title}</FieldError>
          </div>

          <div>
            <FieldLabel required htmlFor="tf-assignee">
              Assign to
            </FieldLabel>
            <Select id="tf-assignee" value={v.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
              <option value="">Choose a person…</option>
              {grouped.map((g) => (
                <optgroup key={g.role} label={ROLE_LABELS[g.role]}>
                  {g.people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </optgroup>
              ))}
              {/* Keep the current assignee selectable even if deactivated since. */}
              {task && !assignees.some((a) => a.id === task.assigneeId) && <option value={task.assigneeId}>{task.assigneeName}</option>}
            </Select>
            <FieldError>{errors.assigneeId}</FieldError>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="tf-priority">Priority</FieldLabel>
              <Select id="tf-priority" value={v.priority} onChange={(e) => set("priority", e.target.value as StaffTaskFormValues["priority"])}>
                {STAFF_TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {STAFF_TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel htmlFor="tf-due">Due ({zone})</FieldLabel>
              <Input id="tf-due" type="datetime-local" value={v.due} onChange={(e) => set("due", e.target.value)} />
              <FieldError>{errors.due}</FieldError>
            </div>
          </div>

          <div className="sm:col-span-2">
            <FieldLabel htmlFor="tf-description">Description</FieldLabel>
            <Textarea id="tf-description" rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} />
            <FieldError>{errors.description}</FieldError>
          </div>

          {losingBrief && (
            <div role="alert" className="rounded-app border border-warning-text/30 bg-warning-bg p-3 text-sm text-warning-text sm:col-span-2">
              The new assignee isn&apos;t an editor: the raw files link, reference link and script will be removed when you save.
            </div>
          )}

          {editor && (
            <fieldset className="grid grid-cols-1 gap-4 rounded-app border border-gold/30 bg-gold-bg/40 p-4 sm:col-span-2 sm:grid-cols-2">
              <legend className="px-1 text-xs font-semibold text-text-secondary">Editor brief</legend>
              <div>
                <FieldLabel required htmlFor="tf-raw">
                  Raw files link (Google Drive)
                </FieldLabel>
                <Input id="tf-raw" type="url" placeholder="https://drive.google.com/…" value={v.rawFilesUrl} onChange={(e) => set("rawFilesUrl", e.target.value)} />
                <FieldError>{errors.rawFilesUrl}</FieldError>
              </div>
              <div>
                <FieldLabel htmlFor="tf-ref">Reference edit link</FieldLabel>
                <Input id="tf-ref" type="url" placeholder="An example of the style you want" value={v.referenceUrl} onChange={(e) => set("referenceUrl", e.target.value)} />
                <FieldError>{errors.referenceUrl}</FieldError>
              </div>
              <div className="sm:col-span-2">
                <FieldLabel htmlFor="tf-script">Script</FieldLabel>
                <Textarea id="tf-script" rows={5} value={v.script} onChange={(e) => set("script", e.target.value)} />
                <FieldError>{errors.script}</FieldError>
              </div>
            </fieldset>
          )}

          <div>
            <FieldLabel htmlFor="tf-client">Client (optional)</FieldLabel>
            {v.clientId ? (
              <div className="flex items-center gap-2 rounded-app-sm border border-border bg-card px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{clientName ?? "Selected client"}</span>
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline"
                  onClick={() => {
                    set("clientId", "");
                    set("eventId", "");
                    setClientName(null);
                  }}
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input id="tf-client" placeholder="Search clients…" value={clientQuery} onChange={(e) => setClientQuery(e.target.value)} autoComplete="off" />
                {shownClientOptions.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-app-sm border border-border bg-card shadow-app-md">
                    {shownClientOptions.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-primary-bg"
                          onClick={() => {
                            set("clientId", c.id);
                            set("eventId", "");
                            setClientName(c.businessName);
                            setClientQuery("");
                            setClientOptions([]);
                          }}
                        >
                          {c.businessName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div>
            <FieldLabel htmlFor="tf-event">Event (optional)</FieldLabel>
            <Select id="tf-event" value={v.eventId} disabled={!v.clientId || !events || events.length === 0} onChange={(e) => set("eventId", e.target.value)}>
              <option value="">{!v.clientId ? "Pick a client first" : events && events.length === 0 ? "No events" : "None"}</option>
              {(events ?? []).map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} · {formatInZone(ev.startsAt, zone)}
                </option>
              ))}
              {task?.eventId && v.eventId === task.eventId && !(events ?? []).some((ev) => ev.id === task.eventId) && (
                <option value={task.eventId}>{task.eventTitle ?? "Linked event"}</option>
              )}
            </Select>
          </div>

          <div className="sm:col-span-2">
            <FieldLabel htmlFor="tf-links">Reference links (one per line)</FieldLabel>
            <Textarea id="tf-links" rows={2} placeholder="https://…" value={v.referenceLinks} onChange={(e) => set("referenceLinks", e.target.value)} />
            <FieldError>{errors.referenceLinks}</FieldError>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border-light px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          {formError && <p className="text-sm text-error sm:mr-auto">{formError}</p>}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
