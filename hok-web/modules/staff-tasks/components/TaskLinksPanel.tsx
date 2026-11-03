"use client";

import { useState } from "react";
import {
  TASK_LINKS_MAX,
  TASK_LINK_KIND_LABELS,
  formatInZone,
  isHttpUrl,
  linkDisplayName,
  type StaffTask,
  type TaskLink,
  type TaskLinkKind,
} from "../../../lib/domain";
import { staffTasksApi } from "../api/staffTasksApi";
import { describeTaskError } from "./taskUi";
import { Panel } from "../../../components/ui/Panel";
import { Button } from "../../../components/ui/Button";
import { FieldLabel, Input } from "../../../components/ui/Field";
import { Select } from "../../../components/ui/Select";
import { Icon } from "../../../components/ui/Icon";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { useToast } from "../../../components/ui/Toast";

const COPY: Record<TaskLinkKind, { subtitle: string; empty: string }> = {
  brief: { subtitle: "Raw files, references, anything to start from", empty: "No links yet." },
  delivered: { subtitle: "What the assignee hands back", empty: "Nothing delivered yet." },
};

/**
 * The task's links, in two lists. "Brief and inputs": the creator, a manager or
 * the Admin adds them. "Delivered work": the assignee or the Admin adds them,
 * and (when `task.canShare`) a delivered link can be shared with the client.
 * Anyone who may see the task sees the links; the API decides who may add,
 * delete or share, the buttons only follow its flags.
 */
export function TaskLinksPanel({
  task,
  viewerId,
  isAdmin,
  zone,
  onTask,
  onShare,
}: {
  task: StaffTask;
  viewerId: string;
  isAdmin: boolean;
  zone: string;
  onTask: (task: StaffTask) => void;
  onShare: (link: TaskLink) => void;
}) {
  const canAdd: Record<TaskLinkKind, boolean> = {
    brief: task.canManage,
    delivered: isAdmin || task.assigneeId === viewerId,
  };
  return (
    <>
      {(["brief", "delivered"] as const).map((kind) => (
        <LinkList key={kind} kind={kind} task={task} viewerId={viewerId} zone={zone} canAdd={canAdd[kind]} onTask={onTask} onShare={onShare} />
      ))}
    </>
  );
}

function LinkList({
  kind,
  task,
  viewerId,
  zone,
  canAdd,
  onTask,
  onShare,
}: {
  kind: TaskLinkKind;
  task: StaffTask;
  viewerId: string;
  zone: string;
  canAdd: boolean;
  onTask: (task: StaffTask) => void;
  onShare: (link: TaskLink) => void;
}) {
  const confirm = useConfirm();
  const { showToast } = useToast();
  const links = task.links.filter((l) => l.kind === kind);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [stageId, setStageId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const atLimit = task.links.length >= TASK_LINKS_MAX;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!isHttpUrl(url)) return setError("Paste a full address starting with https://");
    setError(null);
    setBusy(true);
    try {
      const { task: saved } = await staffTasksApi.addLink(task.id, { kind, url: url.trim(), label: label.trim() || undefined, stageId: stageId || undefined });
      onTask(saved);
      setUrl("");
      setLabel("");
      setStageId("");
      setAdding(false);
      showToast("Link added.", "success");
    } catch (err) {
      setError(describeTaskError(err, "Failed to add the link"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(link: TaskLink) {
    const ok = await confirm({ title: `Remove "${linkDisplayName(link)}"?`, body: "The link is removed from this task. The file it points to is not touched.", confirmLabel: "Remove", danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      const { task: saved } = await staffTasksApi.removeLink(task.id, link.id);
      onTask(saved);
      showToast("Link removed.", "success");
    } catch (err) {
      showToast(describeTaskError(err, "Failed to remove the link"), "error");
    } finally {
      setBusy(false);
    }
  }

  const idBase = `tl-${kind}`;
  return (
    <Panel
      title={TASK_LINK_KIND_LABELS[kind]}
      subtitle={COPY[kind].subtitle}
      action={
        canAdd && !adding && !atLimit ? (
          <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} /> Add link
          </Button>
        ) : undefined
      }
    >
      {adding && (
        <form onSubmit={add} className="flex flex-col gap-3 border-b border-border-light bg-accent-bg/40 p-4" aria-label={`Add to ${TASK_LINK_KIND_LABELS[kind]}`}>
          <div>
            <FieldLabel htmlFor={`${idBase}-url`} required>
              Address
            </FieldLabel>
            <Input id={`${idBase}-url`} type="url" inputMode="url" placeholder="https://drive.google.com/…" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor={`${idBase}-label`}>Label (optional)</FieldLabel>
              <Input id={`${idBase}-label`} maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <FieldLabel htmlFor={`${idBase}-stage`}>Stage (optional)</FieldLabel>
              <Select id={`${idBase}-stage`} value={stageId} onChange={(e) => setStageId(e.target.value)}>
                <option value="">No stage</option>
                {task.stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.position}. {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add link"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {links.length === 0 ? (
        <p className="px-5 py-4 text-sm text-text-muted">{COPY[kind].empty}</p>
      ) : (
        <ul className="inset-rows" aria-label={TASK_LINK_KIND_LABELS[kind]}>
          {links.map((l) => (
            <li key={l.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-3" data-testid="task-link">
              <div className="min-w-0 flex-1">
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 text-[15px] font-medium break-all text-primary hover:underline">
                  {linkDisplayName(l)}
                  <Icon name="external-link" size={13} className="shrink-0" />
                </a>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                  {l.stageName && <span className="rounded-full bg-accent-bg px-2 py-0.5 font-medium text-text-secondary ring-1 ring-border ring-inset">{l.stageName}</span>}
                  <span>
                    {l.addedByName ? `Added by ${l.addedByName} · ` : "Added "}
                    {formatInZone(l.createdAt, zone)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {kind === "delivered" &&
                  (l.sharedAssetId ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2.5 py-1 text-xs font-medium text-success">
                      <Icon name="check" size={12} strokeWidth={3} /> Shared with client
                    </span>
                  ) : task.canShare ? (
                    <Button variant="outline" className="px-3 py-1.5 text-xs" disabled={busy} onClick={() => onShare(l)}>
                      <Icon name="share" size={14} /> Share with client
                    </Button>
                  ) : null)}
                {(l.addedById === viewerId || task.canManage) && (
                  <Button variant="ghost" className="px-2.5 py-1.5" aria-label={`Remove ${linkDisplayName(l)}`} disabled={busy} onClick={() => remove(l)}>
                    <Icon name="trash" size={15} />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
