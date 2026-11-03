"use client";

import { useEffect, useId, useState } from "react";
import { linkDisplayName, type StaffTask, type StageRef, type TaskLink } from "../../../lib/domain";
import { eventsApi } from "../../events/api/eventsApi";
import { staffTasksApi } from "../api/staffTasksApi";
import { describeTaskError } from "./taskUi";
import { Modal } from "../../../components/ui/Modal";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Select } from "../../../components/ui/Select";
import { Icon } from "../../../components/ui/Icon";

/**
 * "Share with client": turns a delivered link into an asset on the task's
 * event that the client sees on its portal page. The title and the event stage
 * are optional; the stages are that EVENT's (not the task's), loaded when the
 * dialog opens. The API checks the viewer may write assets for this client.
 */
export function ShareLinkModal({
  task,
  link,
  onClose,
  onShared,
}: {
  task: StaffTask;
  link: TaskLink;
  onClose: () => void;
  onShared: (task: StaffTask) => void;
}) {
  const titleId = useId();
  const [title, setTitle] = useState(link.label ?? "");
  const [stageId, setStageId] = useState("");
  const [stages, setStages] = useState<StageRef[] | null>(null);
  const [stagesError, setStagesError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task.eventId) return;
    let cancelled = false;
    eventsApi
      .get(task.eventId)
      .then((r) => !cancelled && setStages(r.event.stages))
      .catch(() => !cancelled && setStagesError(true));
    return () => {
      cancelled = true;
    };
  }, [task.eventId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { task: saved } = await staffTasksApi.shareLink(task.id, link.id, { title: title.trim() || undefined, stageId: stageId || undefined });
      onShared(saved);
    } catch (err) {
      setError(describeTaskError(err, "Failed to share the link"));
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy={titleId} panelClassName="max-w-md p-6">
      <h2 id={titleId} className="font-serif text-lg text-text-primary">
        Share with client
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        The client will see <span className="font-medium text-text-secondary">{linkDisplayName(link)}</span> under “Shared with you” on the page for {task.eventTitle ?? "the event"} in their portal.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3.5">
        <div>
          <FieldLabel htmlFor="share-title">Title the client sees</FieldLabel>
          <Input id="share-title" value={title} maxLength={160} placeholder="Delivered work" onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="share-stage">Event stage (optional)</FieldLabel>
          <Select id="share-stage" value={stageId} disabled={!stages} onChange={(e) => setStageId(e.target.value)}>
            <option value="">{stages || stagesError ? "No stage" : "Loading stages…"}</option>
            {(stages ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.position}. {s.name}
              </option>
            ))}
          </Select>
          <FieldError>{stagesError ? "Couldn’t load the event’s stages. You can still share without one." : null}</FieldError>
        </div>
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving}>
            <Icon name="share" size={15} /> {saving ? "Sharing…" : "Share with client"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
