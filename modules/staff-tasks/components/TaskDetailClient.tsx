"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  STAFF_TASK_STATUS_LABELS,
  describeTaskUpdate,
  formatInZone,
  isTaskOverdue,
  nextStatuses,
  type StaffTask,
  type StaffTaskStatus,
} from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { staffTasksApi } from "../api/staffTasksApi";
import { DueLabel, PriorityPill, TaskStatusPill, describeTaskError, roleLabel } from "./taskUi";
import { TaskFormModal } from "./TaskFormModal";
import { Button, ButtonLink } from "../../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { FieldLabel } from "../../../components/ui/Field";
import { Textarea } from "../../../components/ui/Select";
import { Icon } from "../../../components/ui/Icon";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";

/** Button wording for a status the task can move to. */
const ACTION_LABELS: Record<StaffTaskStatus, string> = {
  todo: "Back to To do",
  in_progress: "Start / In progress",
  blocked: "Mark blocked",
  done: "Mark done",
};

/** A link the staff opens in a new tab (never the app's own window). */
function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 break-all text-primary underline">
      {children}
      <Icon name="external-link" size={13} className="shrink-0" />
    </a>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="min-w-0 text-text-primary">{children}</span>
    </div>
  );
}

/**
 * One task (FR-TSK-04/05/06/10): details, the editor brief, the status
 * actions with an optional comment, a comment box and the timeline. The
 * assignee and the Admin work on it; only the Admin edits, reopens or deletes.
 */
export function TaskDetailClient({ initialTask, isAdmin, viewerId, zone }: { initialTask: StaffTask; isAdmin: boolean; viewerId: string; zone: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [task, setTask] = useState<StaffTask>(initialTask);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const canWork = isAdmin || task.assigneeId === viewerId;
  const overdue = isTaskOverdue(task);
  const hasBrief = !!(task.rawFilesUrl || task.referenceUrl || task.script);

  async function run(action: () => Promise<{ task: StaffTask }>, success: string, fallback: string) {
    setBusy(true);
    try {
      const { task: saved } = await action();
      setTask(saved);
      setComment("");
      setConflict(false);
      showToast(success, "success");
    } catch (err) {
      if (isApiErrorCode(err, "STAFF_TASK_MODIFIED")) setConflict(true);
      showToast(describeTaskError(err, fallback), "error");
    } finally {
      setBusy(false);
    }
  }

  async function reload() {
    try {
      const { task: fresh } = await staffTasksApi.get(task.id);
      setTask(fresh);
      setConflict(false);
    } catch (err) {
      showToast(describeTaskError(err, "Failed to reload the task"), "error");
    }
  }

  function changeStatus(status: StaffTaskStatus) {
    void run(() => staffTasksApi.changeStatus(task.id, status, task.version, comment.trim()), `Moved to ${STAFF_TASK_STATUS_LABELS[status]}.`, "Failed to change the status");
  }

  async function reopen(status: Exclude<StaffTaskStatus, "done">) {
    const ok = await confirm({ title: "Reopen this task?", body: `It goes back to ${STAFF_TASK_STATUS_LABELS[status]} and ${task.assigneeName} can work on it again.`, confirmLabel: "Reopen" });
    if (ok) void run(() => staffTasksApi.reopen(task.id, status, task.version, comment.trim()), "Task reopened.", "Failed to reopen the task");
  }

  function postComment() {
    if (!comment.trim()) return;
    void run(() => staffTasksApi.comment(task.id, comment.trim()), "Comment added.", "Failed to add the comment");
  }

  async function handleDelete() {
    const ok = await confirm({ title: `Delete "${task.title}"?`, body: "The task and its timeline are removed for good.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await staffTasksApi.remove(task.id);
      showToast("Task deleted.", "success");
      router.push("/app/tasks");
    } catch (err) {
      showToast(describeTaskError(err, "Failed to delete the task"), "error");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title break-words">{task.title}</h1>
            <TaskStatusPill status={task.status} />
            <PriorityPill priority={task.priority} />
          </div>
          <p className="mt-1 text-sm text-text-muted">
            For {task.assigneeName} ({roleLabel(task.assigneeRole)}){task.assignedByName ? ` · assigned by ${task.assignedByName}` : ""}
          </p>
        </div>
        <ButtonLink href="/app/tasks" variant="outline">
          <Icon name="chevron-right" size={15} className="rotate-180" /> {isAdmin ? "All tasks" : "My tasks"}
        </ButtonLink>
      </div>

      {conflict && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-app border border-error/30 bg-error-bg p-3 text-sm text-error">
          <span>Someone else changed this task in the meantime.</span>
          <Button variant="outline" onClick={reload}>
            Reload latest
          </Button>
        </div>
      )}
      {overdue && (
        <div className="mb-4 flex items-center gap-2 rounded-app border border-error/30 bg-error-bg p-3 text-sm font-medium text-error">
          <Icon name="alert" size={16} /> This task is overdue.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Card>
            <CardHeader icon="📋" title="Details" subtitle={`Created ${formatInZone(task.createdAt, zone)}`} />
            <CardBody className="flex flex-col gap-2.5">
              <Row label="Due">
                <DueLabel dueAt={task.dueAt} status={task.status} zone={zone} />
              </Row>
              {task.completedAt && <Row label="Completed">{formatInZone(task.completedAt, zone)}</Row>}
              <Row label="Client">{task.clientName ?? <span className="text-text-muted">None</span>}</Row>
              {task.eventId && <Row label="Event">{task.eventTitle ?? "Linked event"}</Row>}
              <Row label="Description">
                <span className="whitespace-pre-wrap">{task.description || <span className="text-text-muted">No description.</span>}</span>
              </Row>
              {task.referenceLinks.length > 0 && (
                <Row label="References">
                  <span className="flex flex-col gap-1">
                    {task.referenceLinks.map((l) => (
                      <ExternalLink key={l.url} href={l.url}>
                        {l.label ?? l.url}
                      </ExternalLink>
                    ))}
                  </span>
                </Row>
              )}
            </CardBody>
          </Card>

          {hasBrief && (
            <Card accent>
              <CardHeader icon="🎨" iconTone="gold" title="Editor brief" subtitle="Raw files, reference and script" />
              <CardBody className="flex flex-col gap-3">
                {task.rawFilesUrl && (
                  <Row label="Raw files">
                    <ExternalLink href={task.rawFilesUrl}>Open the Drive folder</ExternalLink>
                  </Row>
                )}
                {task.referenceUrl && (
                  <Row label="Reference edit">
                    <ExternalLink href={task.referenceUrl}>Open the reference</ExternalLink>
                  </Row>
                )}
                {task.script && (
                  <div>
                    <div className="mb-1 text-sm text-text-muted">Script</div>
                    <p className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-app-sm border border-border-light bg-app-bg/60 p-3 text-sm text-text-primary">{task.script}</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setEditOpen(true)}>
                <Icon name="edit" size={16} /> Edit or reassign
              </Button>
              <Button variant="danger" disabled={busy} onClick={handleDelete}>
                <Icon name="trash" size={16} /> Delete
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {canWork && (
            <Card>
              <CardHeader icon="✅" title="Update" subtitle="Change the status or add a comment" />
              <CardBody className="flex flex-col gap-3">
                <div>
                  <FieldLabel htmlFor="task-comment">Comment (optional with a status change)</FieldLabel>
                  <Textarea id="task-comment" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What's the update?" />
                </div>
                {task.status === "done" ? (
                  isAdmin ? (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" disabled={busy} onClick={() => reopen("todo")}>
                        <Icon name="refresh" size={15} /> Reopen (To do)
                      </Button>
                      <Button variant="outline" disabled={busy} onClick={() => reopen("in_progress")}>
                        Reopen (In progress)
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">This task is done. Only the Admin can reopen it.</p>
                  )
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {nextStatuses(task.status).map((s) => (
                      <Button key={s} variant={s === "done" ? "primary" : "outline"} disabled={busy} onClick={() => changeStatus(s)}>
                        {ACTION_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                )}
                <Button variant="ghost" disabled={busy || !comment.trim()} onClick={postComment} className="self-start">
                  <Icon name="send" size={15} /> Post comment only
                </Button>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader icon="🕓" title="Timeline" subtitle="Newest first" />
            <CardBody>
              <ol className="flex flex-col gap-3">
                {task.updates.map((u) => (
                  <li key={u.id} className="border-l-2 border-border pl-3">
                    <div className="text-sm text-text-primary">
                      <span className="font-semibold">{u.authorName ?? "Someone"}</span> {describeTaskUpdate(u)}
                    </div>
                    <div className="text-xs text-text-muted">{formatInZone(u.createdAt, zone)}</div>
                    {u.comment && <p className="mt-1 whitespace-pre-wrap rounded-app-sm bg-app-bg/70 p-2 text-sm text-text-secondary">{u.comment}</p>}
                  </li>
                ))}
                {task.updates.length === 0 && <li className="text-sm text-text-muted">Nothing yet.</li>}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      {isAdmin && editOpen && (
        <TaskFormModal
          open
          task={task}
          zone={zone}
          onClose={() => setEditOpen(false)}
          onSaved={(saved) => {
            setEditOpen(false);
            setTask(saved);
            setConflict(false);
            showToast("Task saved.", "success");
          }}
        />
      )}
    </div>
  );
}
