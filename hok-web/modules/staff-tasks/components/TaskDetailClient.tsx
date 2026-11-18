"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  approvedStageIds,
  blockedByWithPosition,
  blockedReason,
  describeTaskUpdate,
  formatInZone,
  hasCapability,
  isMoveBlocked,
  isTaskOverdue,
  nextStageOf,
  otherStages,
  type Role,
  type StaffTask,
  type TaskLink,
} from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { staffTasksApi } from "../api/staffTasksApi";
import { ApprovalCard } from "../../approvals/components/ApprovalCard";
import { ApprovalHistory } from "../../approvals/components/ApprovalHistory";
import { DueLabel, PersonDot, PriorityPill, TaskStatusPill, describeTaskError, roleLabel } from "./taskUi";
import { TaskFormModal } from "./TaskFormModal";
import { TaskLinksPanel } from "./TaskLinksPanel";
import { ShareLinkModal } from "./ShareLinkModal";
import { StageTracker } from "../../events/components/StageTracker";
import { PartOf } from "../../work-tree/components/PartOf";
import { PartsSection } from "../../work-tree/components/PartsSection";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Panel } from "../../../components/ui/Panel";
import { FieldLabel } from "../../../components/ui/Field";
import { Select, Textarea } from "../../../components/ui/Select";
import { Icon } from "../../../components/ui/Icon";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 text-sm sm:grid-cols-[7.5rem_1fr] sm:gap-3">
      <span className="text-text-muted">{label}</span>
      <span className="min-w-0 text-text-primary">{children}</span>
    </div>
  );
}

/**
 * One task (FR-TSK-04/05/06, round 2): the stage tracker, the actions that move
 * it along, blocked / unblocked, the links, the brief and the timeline. The
 * assignee, the person who gave it and the Admin move it between stages (any
 * stage, forward or back) and complete it from the last one; the assignee and
 * the Admin raise a "blocked" flag with a reason. Only the Admin or the creator
 * (`task.canManage`) edits, reassigns, reopens, deletes or adds brief links. A
 * client manager who is none of those sees it read-only. Status is derived by the
 * API from the stage; this screen never sets it.
 */
export function TaskDetailClient({ initialTask, role, viewerId, zone }: { initialTask: StaffTask; role: Role; viewerId: string; zone: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const [task, setTask] = useState<StaffTask>(initialTask);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [jumpTo, setJumpTo] = useState("");
  const [reopenTo, setReopenTo] = useState("");
  const [blocking, setBlocking] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [sharing, setSharing] = useState<TaskLink | null>(null);

  const isAdmin = role === "admin";
  const isAssignee = task.assigneeId === viewerId;
  const canWork = isAdmin || isAssignee || task.assignedById === viewerId;
  const canBlock = isAdmin || isAssignee;
  const canManage = task.canManage;
  const overdue = isTaskOverdue(task);
  const done = task.status === "done";
  const blocked = task.status === "blocked";
  const next = nextStageOf(task.stages, task.currentStage.id);
  const others = otherStages(task.stages, task.currentStage.id);
  const lastStage = task.stages[task.stages.length - 1];
  const blockedBy = blockedByWithPosition(task.nextBlockedBy, task.stages);
  const currentPos = task.currentStage.position;
  const currentWithApprovers = task.stages.find((s) => s.id === task.currentStage.id);
  const nextBlocked = next ? isMoveBlocked(blockedBy, currentPos, next.position) : false;
  const completeBlocked = isMoveBlocked(blockedBy, currentPos, null);
  const share = done ? 100 : task.stageCount > 0 ? Math.round((task.currentStage.position / task.stageCount) * 100) : 0;
  // Parts (round 4): whoever may move the task adds them. An event part needs events:write and a client on the task; a task part needs staff_tasks:assign.
  const mayMakeEvent = hasCapability(role, "events:write");
  const canEventPart = mayMakeEvent && !!task.clientId;
  const canTaskPart = hasCapability(role, "staff_tasks:assign");
  const partCount = task.children.length + task.hiddenChildren;

  async function run(action: () => Promise<{ task: StaffTask }>, success: string, fallback: string): Promise<boolean> {
    setBusy(true);
    try {
      const { task: saved } = await action();
      setTask(saved);
      setComment("");
      setJumpTo("");
      setReopenTo("");
      setBlocking(false);
      setBlockReason("");
      setConflict(false);
      showToast(success, "success");
      return true;
    } catch (err) {
      if (isApiErrorCode(err, "STAFF_TASK_MODIFIED")) setConflict(true);
      showToast(describeTaskError(err, fallback), "error");
      return false;
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

  const moveTo = (stageId: string, name: string) => void run(() => staffTasksApi.moveStage(task.id, stageId, task.version, comment.trim()), `Moved to ${name}.`, "Failed to move the task");
  const complete = () => void run(() => staffTasksApi.complete(task.id, task.version, comment.trim()), "Task completed.", "Failed to complete the task");
  const unblock = () => void run(() => staffTasksApi.unblock(task.id, task.version, comment.trim()), "Task unblocked.", "Failed to unblock the task");
  const markBlocked = () => void run(() => staffTasksApi.block(task.id, blockReason.trim(), task.version), "Marked as blocked.", "Failed to mark the task blocked");

  async function reopen() {
    const stageId = reopenTo || lastStage?.id;
    const target = task.stages.find((s) => s.id === stageId);
    if (!stageId || !target) return;
    const ok = await confirm({ title: "Reopen this task?", body: `It goes back to ${target.name} and ${task.assigneeName} can work on it again.`, confirmLabel: "Reopen" });
    if (ok) void run(() => staffTasksApi.reopen(task.id, task.version, stageId, comment.trim()), "Task reopened.", "Failed to reopen the task");
  }

  function postComment() {
    if (!comment.trim()) return;
    void run(() => staffTasksApi.comment(task.id, comment.trim()), "Comment added.", "Failed to add the comment");
  }

  async function handleDelete() {
    const stay = partCount > 0 ? ` ${partCount} ${partCount === 1 ? "part" : "parts"} will stay as separate items.` : "";
    const ok = await confirm({ title: `Delete "${task.title}"?`, body: `The task and its timeline are removed for good.${stay}`, confirmLabel: "Delete", danger: true });
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
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <Link href="/app/tasks" className="mb-3 inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary">
          <Icon name="chevron-right" size={14} className="rotate-180" /> {hasCapability(role, "staff_tasks:assign") ? "Tasks" : "My tasks"}
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <PartOf parent={task.parent} />
            <h1 className="page-title break-words">{task.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <TaskStatusPill status={task.status} />
              <PriorityPill priority={task.priority} />
              <span className="flex items-center gap-2 text-sm text-text-muted">
                <PersonDot name={task.assigneeName} size={24} />
                {task.assigneeName} ({roleLabel(task.assigneeRole)}){task.assignedByName ? ` · Assigned by ${task.assignedByName}` : ""}
              </span>
            </div>
          </div>
          {canManage && (
            <div className="page-actions shrink-0">
              <Button variant="outline" disabled={busy} onClick={() => setEditOpen(true)}>
                <Icon name="edit" size={16} /> Edit or reassign
              </Button>
              <Button variant="danger" disabled={busy} onClick={handleDelete}>
                <Icon name="trash" size={16} /> Delete
              </Button>
            </div>
          )}
        </div>
      </header>

      {!canWork && (
        <div className="mb-4 flex items-center gap-2 rounded-app-lg bg-accent-bg p-3.5 text-sm text-text-secondary">
          <Icon name="eye" size={16} className="shrink-0" /> View only: you&apos;re on this client&apos;s team.
        </div>
      )}
      {conflict && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-app-lg border border-error/30 bg-error-bg p-3.5 text-sm text-error">
          <span>Someone else changed this task in the meantime.</span>
          <Button variant="outline" onClick={reload}>
            Reload latest
          </Button>
        </div>
      )}
      {blocked && (
        <div role="status" data-testid="blocked-banner" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-app-lg border border-warning-text/30 bg-warning-bg p-3.5 text-sm text-warning-text">
          <span className="flex min-w-0 items-start gap-2">
            <Icon name="ban" size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="font-semibold">Blocked.</span> <span className="break-words whitespace-pre-wrap">{task.blockedReason}</span>
            </span>
          </span>
          {canWork && (
            <Button variant="outline" disabled={busy} onClick={unblock}>
              Unblock
            </Button>
          )}
        </div>
      )}
      {overdue && (
        <div className="mb-4 flex items-center gap-2 rounded-app-lg border border-error/30 bg-error-bg p-3.5 text-sm font-medium text-error">
          <Icon name="alert" size={16} /> This task is overdue.
        </div>
      )}

      <Card accent className="mb-5 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 pt-5 pb-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs text-text-muted">{done ? "Complete" : `Stage ${task.currentStage.position} of ${task.stageCount}`}</p>
            <h2 className="mt-1 font-serif text-2xl leading-tight break-words text-text-primary sm:text-[28px]">{done ? "All stages done" : task.currentStage.name}</h2>
            <p className="mt-0.5 text-xs text-text-muted">{task.templateName}</p>
          </div>
          <div className="w-full sm:w-56">
            <div className="mb-1.5 flex justify-between text-xs text-text-muted">
              <span>Progress</span>
              <span className="figure text-text-primary">{share}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border-light">
              <div className="grow-x h-full rounded-full bg-primary" style={{ width: `${Math.max(share, 3)}%` }} />
            </div>
          </div>
        </div>
        <div className="border-t border-border-light bg-accent-bg/40 px-5 py-5 sm:px-6 sm:py-6">
          <StageTracker stages={task.stages} currentStageId={task.currentStage.id} label="Task stages" done={done} approvedStageIds={approvedStageIds(task.approvals)} />
        </div>
      </Card>

      <div className="mb-5 empty:hidden">
        <PartsSection
          kind="task"
          currentStageId={task.currentStage.id}
          itemId={task.id}
          itemTitle={task.title}
          stages={task.stages}
          parts={task.children}
          hiddenParts={task.hiddenChildren}
          canAdd={canWork && !done}
          canEvent={canEventPart}
          canTask={canTaskPart}
          eventNeedsClient={mayMakeEvent && !task.clientId}
          client={task.clientId && task.clientName ? { id: task.clientId, name: task.clientName } : null}
          event={task.eventId && task.eventTitle ? { id: task.eventId, title: task.eventTitle } : null}
          zone={zone}
          onChanged={() => void reload()}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
          <Panel icon="clipboard" title="The brief" subtitle={`Created ${formatInZone(task.createdAt, zone)}`}>
            <div className="flex flex-col gap-3.5 p-5">
              <Row label="Due">
                <DueLabel dueAt={task.dueAt} status={task.status} zone={zone} />
              </Row>
              {task.completedAt && <Row label="Completed">{formatInZone(task.completedAt, zone)}</Row>}
              <Row label="Client">{task.clientName ?? <span className="text-text-muted">None</span>}</Row>
              {task.eventId && <Row label="Event">{task.eventTitle ?? "Linked event"}</Row>}
              <Row label="Description">
                <span className="whitespace-pre-wrap">{task.description || <span className="text-text-muted">No description.</span>}</span>
              </Row>
              {task.brief && (
                <div>
                  <div className="mb-1.5 text-sm text-text-muted">Brief</div>
                  <p className="max-h-96 overflow-y-auto rounded-app border border-border-light bg-accent-bg p-3.5 text-sm leading-relaxed whitespace-pre-wrap text-text-primary">{task.brief}</p>
                </div>
              )}
            </div>
          </Panel>

          <TaskLinksPanel task={task} viewerId={viewerId} isAdmin={isAdmin} zone={zone} onTask={setTask} onShare={setSharing} />
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:col-span-5">
          {currentWithApprovers && !done && (
            <ApprovalCard
              subject="task"
              subjectId={task.id}
              stage={currentWithApprovers}
              approvals={task.approvals}
              canRequest={canWork}
              zone={zone}
              onChanged={() => void reload()}
            />
          )}

          {canWork && (
            <Panel icon="check-circle" title="Update" subtitle={done ? "This task is complete" : "Move it along, or add a comment"}>
              <div className="flex flex-col gap-3 p-5">
                <div>
                  <FieldLabel htmlFor="task-comment">{done ? "Comment" : "Comment (optional with a stage change)"}</FieldLabel>
                  <Textarea id="task-comment" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What's the update?" />
                </div>

                {done ? (
                  canManage ? (
                    <div className="flex flex-col gap-2">
                      <FieldLabel htmlFor="task-reopen-stage">Reopen at</FieldLabel>
                      <Select id="task-reopen-stage" value={reopenTo || lastStage?.id || ""} onChange={(e) => setReopenTo(e.target.value)}>
                        {task.stages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.position}. {s.name}
                          </option>
                        ))}
                      </Select>
                      <Button variant="outline" disabled={busy} onClick={reopen}>
                        <Icon name="refresh" size={15} /> Reopen
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">This task is done. Only the person who gave it (or the Admin) can reopen it.</p>
                  )
                ) : (
                  <>
                    {next ? (
                      <Button disabled={busy || nextBlocked} onClick={() => moveTo(next.id, next.name)}>
                        Move to {next.name}
                      </Button>
                    ) : (
                      <Button disabled={busy || completeBlocked} onClick={complete}>
                        <Icon name="check" size={15} strokeWidth={3} /> Mark complete
                      </Button>
                    )}
                    {blockedBy && (next ? nextBlocked : completeBlocked) && (
                      <p data-testid="move-blocked-reason" className="-mt-1 flex items-center gap-1.5 text-xs text-text-muted">
                        <Icon name="lock" size={12} className="shrink-0" /> {blockedReason(blockedBy)}
                      </p>
                    )}

                    {others.length > 0 && (
                      <div className="flex items-end gap-2">
                        <div className="min-w-0 flex-1">
                          <FieldLabel htmlFor="task-jump">Jump to a stage</FieldLabel>
                          <Select id="task-jump" value={jumpTo} onChange={(e) => setJumpTo(e.target.value)}>
                            <option value="">Choose a stage</option>
                            {others.map((s) => (
                              <option key={s.id} value={s.id} disabled={isMoveBlocked(blockedBy, currentPos, s.position)}>
                                {s.position}. {s.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Button
                          variant="outline"
                          disabled={busy || !jumpTo}
                          onClick={() => {
                            const target = task.stages.find((s) => s.id === jumpTo);
                            if (target) moveTo(target.id, target.name);
                          }}
                        >
                          Move
                        </Button>
                      </div>
                    )}

                    {canBlock && !blocked && !blocking && (
                      <Button variant="outline" disabled={busy} onClick={() => setBlocking(true)}>
                        <Icon name="ban" size={15} /> Mark blocked
                      </Button>
                    )}
                    {canBlock && !blocked && blocking && (
                      <div className="flex flex-col gap-2 rounded-app border border-warning-text/30 bg-warning-bg p-3">
                        <FieldLabel htmlFor="task-block-reason" required>
                          What&apos;s blocking it?
                        </FieldLabel>
                        <Textarea id="task-block-reason" rows={2} maxLength={1000} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Waiting for the raw files, the client hasn't approved…" />
                        <div className="flex gap-2">
                          <Button disabled={busy || !blockReason.trim()} onClick={markBlocked}>
                            Mark blocked
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setBlocking(false);
                              setBlockReason("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <Button variant="ghost" disabled={busy || !comment.trim()} onClick={postComment} className="self-start">
                  <Icon name="send" size={15} /> Post comment only
                </Button>
              </div>
            </Panel>
          )}

          <ApprovalHistory approvals={task.approvals} zone={zone} />

          <Panel icon="history" title="Timeline" subtitle="Newest first">
            <ol className="mx-5 mb-5 ml-6 flex flex-col gap-5 border-l border-border" aria-label="Task timeline">
              {task.updates.map((u, i) => (
                <li key={u.id} className="relative pl-5">
                  <span aria-hidden className={`absolute top-1.5 -left-[5px] h-2.5 w-2.5 rounded-full ring-4 ring-card ${i === 0 ? "bg-primary" : "bg-ink"}`} />
                  <div className="text-sm text-text-primary">
                    <span className="font-semibold">{u.authorName ?? "Someone"}</span> {describeTaskUpdate(u)}
                  </div>
                  <div className="text-xs text-text-muted">{formatInZone(u.createdAt, zone)}</div>
                  {u.comment && <p className="mt-1.5 rounded-app bg-accent-bg p-2.5 text-sm whitespace-pre-wrap text-text-secondary">{u.comment}</p>}
                </li>
              ))}
              {task.updates.length === 0 && <li className="pl-5 text-sm text-text-muted">Nothing yet.</li>}
            </ol>
          </Panel>
        </div>
      </div>

      {canManage && editOpen && (
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

      {sharing && (
        <ShareLinkModal
          task={task}
          link={sharing}
          onClose={() => setSharing(null)}
          onShared={(saved) => {
            setSharing(null);
            setTask(saved);
            showToast("Shared with the client.", "success");
          }}
        />
      )}
    </div>
  );
}
