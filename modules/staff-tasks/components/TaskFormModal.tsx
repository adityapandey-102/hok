"use client";

import { useId, useState } from "react";
import {
  STAFF_TASK_PRIORITIES,
  STAFF_TASK_PRIORITY_LABELS,
  buildStaffTaskPayload,
  isEditorRole,
  isoToZonedInput,
  type Role,
  staffTaskFormSchema,
  type StaffTask,
  type StaffTaskFormValues,
} from "../../../lib/domain";
import { teamMembersApi, type TeamMember } from "../../team-members/api/teamMembersApi";
import { eventsApi } from "../../events/api/eventsApi";
import { clientsApi } from "../../clients/api/clientsApi";
import { staffTasksApi } from "../api/staffTasksApi";
import { describeTaskError } from "./taskUi";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Select, Textarea } from "../../../components/ui/Select";
import { SearchSelect } from "../../../components/ui/SearchSelect";
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
  zone,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Present = edit. */
  task?: StaffTask;
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

  // The assignee picker searches the API; remember the picked person's role (it decides whether the editor brief shows).
  const [pickedRole, setPickedRole] = useState<Role | null>(task?.assigneeRole ?? null);
  const role = v.assigneeId ? pickedRole : null;
  const editor = isEditorRole(role);
  const losingBrief = editing && isEditorRole(task!.assigneeRole) && !!role && !editor;

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
            <SearchSelect<TeamMember>
              id="tf-assignee"
              placeholder="Search people…"
              value={v.assigneeId || null}
              selectedLabel={task?.assigneeName}
              load={(q) => teamMembersApi.searchOptions(q)}
              onChange={(id, item) => {
                set("assigneeId", id ?? "");
                setPickedRole(item?.data?.role ?? null);
              }}
            />
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
            <SearchSelect
              id="tf-client"
              placeholder="Search clients…"
              value={v.clientId || null}
              selectedLabel={task?.clientName ?? undefined}
              clearable
              load={clientsApi.searchOptions}
              onChange={(id) => {
                set("clientId", id ?? "");
                set("eventId", "");
              }}
            />
          </div>

          <div>
            <FieldLabel htmlFor="tf-event">Event (optional)</FieldLabel>
            <SearchSelect
              id="tf-event"
              placeholder={v.clientId ? "None" : "Pick a client first"}
              emptyText="No events"
              value={v.eventId || null}
              selectedLabel={task?.eventTitle ?? undefined}
              clearable
              disabled={!v.clientId}
              loadKey={v.clientId}
              load={(q) => eventsApi.searchOptions(v.clientId, q)}
              onChange={(id) => set("eventId", id ?? "")}
            />
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
