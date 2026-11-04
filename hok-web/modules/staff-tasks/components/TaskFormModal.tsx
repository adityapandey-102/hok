"use client";

import { useId, useState } from "react";
import {
  STAFF_TASK_PRIORITIES,
  STAFF_TASK_PRIORITY_LABELS,
  TASK_BRIEF_LINKS_MAX_ON_CREATE,
  buildStaffTaskPayload,
  bulkTitles,
  createdSummary,
  creatingLabel,
  isoToZonedInput,
  type Role,
  staffTaskFormSchema,
  type StageTemplate,
  type StaffTask,
  type StaffTaskFormValues,
  type TaskStage,
} from "../../../lib/domain";
import { teamMembersApi, type TeamMember } from "../../team-members/api/teamMembersApi";
import { templatesApi } from "../../stage-templates/api/templatesApi";
import { eventsApi } from "../../events/api/eventsApi";
import { clientsApi } from "../../clients/api/clientsApi";
import { staffTasksApi } from "../api/staffTasksApi";
import { describeTaskError } from "./taskUi";
import type { PartContext } from "../../work-tree/partContext";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Select, Textarea } from "../../../components/ui/Select";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { Icon } from "../../../components/ui/Icon";

function initialValues(task: StaffTask | undefined, zone: string, defaultDue: string, part?: PartContext): StaffTaskFormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    brief: task?.brief ?? "",
    assigneeId: task?.assigneeId ?? "",
    templateId: "",
    priority: task?.priority ?? "medium",
    due: task ? (task.dueAt ? isoToZonedInput(task.dueAt, zone) : "") : defaultDue,
    clientId: task?.clientId ?? part?.clientId ?? "",
    eventId: task?.eventId ?? part?.eventId ?? "",
    links: [],
  };
}

/** The stage names as a numbered chain (a preview of what the task will go through). */
function StagePreview({ stages, label }: { stages: Pick<TaskStage, "name">[]; label: string }) {
  return (
    <ol aria-label={label} className="mt-2 flex flex-wrap items-center gap-1.5">
      {stages.map((s, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-bg px-2.5 py-1 text-xs text-text-secondary ring-1 ring-border ring-inset">
            <span className="figure text-[10.5px] text-text-muted">{i + 1}</span>
            {s.name}
          </span>
          {i < stages.length - 1 && <Icon name="chevron-right" size={12} className="text-border" />}
        </li>
      ))}
    </ol>
  );
}

/**
 * The create/edit form (FR-TSK-01/02/05) in a modal, for the Admin and the
 * client managers. The assignee picker lists only the people the caller may
 * assign to (the role ladder, decided by the API). On create the template
 * comes next, required: it lists the active task templates offered for the
 * assignee's role and previews its stages. The task copies those stages and
 * they stay fixed, so an edit shows the template name and stages read-only.
 * Every task has a brief (script or instructions) and, on create, a short
 * list of brief links; after that, links are managed on the task page. The
 * due date is typed in the creator's own time zone; `defaultDue` prefills a new
 * task ("YYYY-MM-DDTHH:mm", e.g. 17:00 on the calendar day it was added from).
 * The parent mounts it only while open, so each opening starts from fresh state.
 */
export function TaskFormModal({
  open,
  task,
  zone,
  defaultDue = "",
  part,
  onClose,
  onSaved,
  onPartsDone,
}: {
  open: boolean;
  /** Present = edit. */
  task?: StaffTask;
  zone: string;
  defaultDue?: string;
  /** Round 4: create child tasks (`part.count` of them, one request each) under a stage of a parent. */
  part?: PartContext;
  onClose: () => void;
  onSaved: (task: StaffTask) => void;
  /** Part mode: called once with how many were made when the run finishes (`failure` set if it stopped early; the modal stays until closed). */
  onPartsDone?: (made: number, total: number, failure?: string) => void;
}) {
  const titleId = useId();
  const editing = !!task;
  const [v, setV] = useState<StaffTaskFormValues>(() => initialValues(task, zone, defaultDue, part));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Part mode: how many are made so far, and whether a run stopped halfway (then the form is closed, never resubmitted, to avoid duplicates).
  const [made, setMade] = useState(0);
  const [stopped, setStopped] = useState(false);
  const total = part?.count ?? 1;
  const set = <K extends keyof StaffTaskFormValues>(k: K, value: StaffTaskFormValues[K]) => setV((s) => ({ ...s, [k]: value }));

  // The assignee picker searches the API; the picked person's role decides which task templates are offered.
  const [pickedRole, setPickedRole] = useState<Role | null>(task?.assigneeRole ?? null);
  const role = v.assigneeId ? pickedRole : null;
  const [pickedTemplate, setPickedTemplate] = useState<StageTemplate | null>(null);

  const setLink = (i: number, patch: Partial<{ url: string; label: string }>) => set("links", v.links.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = staffTaskFormSchema(!editing).safeParse(v);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = buildStaffTaskPayload(v, zone, editing);
      if (part && !editing) {
        const titles = bulkTitles(v.title, total);
        let count = 0;
        try {
          for (const title of titles) {
            await staffTasksApi.create({ ...payload, title, parent: part.parent });
            count += 1;
            setMade(count);
          }
        } catch (err) {
          const reason = describeTaskError(err, "Failed to save the task");
          if (count === 0) {
            setFormError(reason);
          } else {
            setFormError(createdSummary(count, total, reason));
            setStopped(true);
          }
          return;
        }
        onPartsDone?.(count, total);
        return;
      }
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

  // Closing after a run that stopped halfway still tells the parent to reload, because some parts exist.
  function close() {
    if (stopped) onPartsDone?.(made, total, formError ?? "stopped");
    else onClose();
  }

  return (
    <Modal open={open} onClose={close} labelledBy={titleId} panelClassName="max-h-[92vh] sm:max-w-2xl">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-serif text-lg text-text-primary">
              {editing ? "Edit task" : part ? (total > 1 ? `New parts (${total} tasks)` : "New part (task)") : "New task"}
            </h2>
            {part && !editing && (
              <p className="truncate text-xs text-text-muted">
                Part of {part.parentTitle} › {part.stageName}
                {total > 1 ? `. Titles get 1 to ${total} added, e.g. “${bulkTitles(v.title || "Title", total)[0]}”.` : ""}
              </p>
            )}
          </div>
          <button type="button" onClick={close} aria-label="Close" className="rounded-app-sm p-1 text-text-muted hover:bg-accent-bg">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          <div>
            <FieldLabel required htmlFor="tf-assignee">
              Assign to
            </FieldLabel>
            <SearchSelect<TeamMember>
              id="tf-assignee"
              placeholder="Search people…"
              value={v.assigneeId || null}
              selectedLabel={task?.assigneeName}
              load={(q) => teamMembersApi.searchOptions(q, { assignable: true })}
              onChange={(id, item) => {
                const nextRole = item?.data?.role ?? null;
                // A template offered for the old role may not be offered for the new one: ask again.
                if (!editing && nextRole !== pickedRole) {
                  set("templateId", "");
                  setPickedTemplate(null);
                }
                set("assigneeId", id ?? "");
                setPickedRole(nextRole);
              }}
            />
            <FieldError>{errors.assigneeId}</FieldError>
          </div>

          {editing ? (
            <div>
              <div className="mb-1.5 text-[13px] font-medium text-text-secondary">Template</div>
              <p className="text-sm text-text-primary">{task!.templateName}</p>
              <p className="text-xs text-text-muted">The stages are fixed once a task is created.</p>
            </div>
          ) : (
            <div>
              <FieldLabel required htmlFor="tf-template">
                Template
              </FieldLabel>
              <SearchSelect<StageTemplate>
                id="tf-template"
                placeholder={role ? "Search task templates…" : "Pick who it’s for first"}
                emptyText="No task template for this role"
                value={v.templateId || null}
                disabled={!role}
                loadKey={role ?? ""}
                load={(q) => (role ? templatesApi.searchTaskOptions(role, q) : Promise.resolve([]))}
                onChange={(id, item) => {
                  set("templateId", id ?? "");
                  setPickedTemplate(item?.data ?? null);
                }}
              />
              <FieldError>{errors.templateId}</FieldError>
            </div>
          )}

          {editing ? (
            <div className="sm:col-span-2">
              <StagePreview stages={task!.stages} label="Task stages" />
            </div>
          ) : (
            pickedTemplate && (
              <div className="-mt-2 sm:col-span-2">
                <StagePreview stages={pickedTemplate.stages} label="Stages of the chosen template" />
              </div>
            )
          )}

          <div className="sm:col-span-2">
            <FieldLabel required htmlFor="tf-title">
              Title
            </FieldLabel>
            <Input id="tf-title" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={160} />
            <FieldError>{errors.title}</FieldError>
          </div>

          <div className="sm:col-span-2">
            <FieldLabel htmlFor="tf-description">Description</FieldLabel>
            <Textarea id="tf-description" rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} />
            <FieldError>{errors.description}</FieldError>
          </div>

          <div className="sm:col-span-2">
            <FieldLabel htmlFor="tf-brief">Brief</FieldLabel>
            <Textarea id="tf-brief" rows={5} placeholder="The script or instructions" value={v.brief} onChange={(e) => set("brief", e.target.value)} />
            <FieldError>{errors.brief}</FieldError>
          </div>

          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:col-span-2">
            <div>
              <FieldLabel htmlFor="tf-due">Due ({zone})</FieldLabel>
              <Input id="tf-due" type="datetime-local" value={v.due} onChange={(e) => set("due", e.target.value)} />
              <FieldError>{errors.due}</FieldError>
            </div>
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
          </div>

          <div>
            <FieldLabel htmlFor="tf-client">Client (optional)</FieldLabel>
            <SearchSelect
              id="tf-client"
              placeholder="Search clients…"
              value={v.clientId || null}
              selectedLabel={task?.clientName ?? part?.clientName ?? undefined}
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
              selectedLabel={task?.eventTitle ?? part?.eventTitle ?? undefined}
              clearable
              disabled={!v.clientId}
              loadKey={v.clientId}
              load={(q) => eventsApi.searchOptions(v.clientId, q)}
              onChange={(id) => set("eventId", id ?? "")}
            />
          </div>

          {editing ? (
            <p className="text-xs text-text-muted sm:col-span-2">Add or remove links on the task page.</p>
          ) : (
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-[13px] font-medium text-text-secondary">Brief links (optional)</legend>
              <p className="mb-2 text-xs text-text-muted">Raw files, a reference edit, a style guide. Paste the address and, if you like, name it.</p>
              <ul className="flex flex-col gap-2">
                {v.links.map((l, i) => (
                  <li key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
                    <Input
                      type="url"
                      inputMode="url"
                      aria-label={`Link ${i + 1} address`}
                      placeholder="https://drive.google.com/…"
                      className="col-span-2 sm:col-span-1"
                      value={l.url}
                      onChange={(e) => setLink(i, { url: e.target.value })}
                    />
                    <Input aria-label={`Link ${i + 1} label`} placeholder="Label (optional)" maxLength={120} value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} />
                    <Button type="button" variant="ghost" className="px-2.5" aria-label={`Remove link ${i + 1}`} onClick={() => set("links", v.links.filter((_, j) => j !== i))}>
                      <Icon name="x" size={14} />
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                className="mt-2"
                disabled={v.links.length >= TASK_BRIEF_LINKS_MAX_ON_CREATE}
                onClick={() => set("links", [...v.links, { url: "", label: "" }])}
              >
                <Icon name="plus" size={14} /> Add link
              </Button>
              <FieldError>{errors.links}</FieldError>
            </fieldset>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border-light px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          {formError && <p role="alert" className="text-sm text-error sm:mr-auto">{formError}</p>}
          {saving && part && total > 1 && <p role="status" className="text-sm text-text-secondary sm:mr-auto">{creatingLabel(made, total)}</p>}
          <Button type="button" variant="outline" onClick={close}>
            {stopped ? "Close" : "Cancel"}
          </Button>
          <Button type="submit" disabled={saving || stopped}>
            {saving ? "Saving…" : editing ? "Save changes" : part ? (total > 1 ? `Create ${total} tasks` : "Create task") : "Create task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
