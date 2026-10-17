"use client";

import { useState } from "react";
import Link from "next/link";
import {
  describeEventTime,
  EVENT_STATE_LABELS,
  EVENT_TYPE_LABELS,
  formatDate,
  type EventDetail,
} from "../../../lib/domain";
import { isApiErrorCode } from "../../../lib/api/client";
import { eventsApi } from "../api/eventsApi";
import { Button, ButtonLink } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Card, CardBody, CardHeader } from "../../../components/ui/Card";
import { FieldLabel } from "../../../components/ui/Field";
import { Select, Textarea } from "../../../components/ui/Select";
import { StatusPill } from "../../../components/ui/StatusPill";
import { useToast } from "../../../components/ui/Toast";
import { useConfirm } from "../../../components/ui/ConfirmDialog";
import { EventForm, type EventFormValues } from "./EventForm";
import { EVENT_STATE_TONES } from "./EventsTab";
import { StageTracker } from "./StageTracker";

/** Event detail: stage tracker, move stage with a note, history, edit / reschedule, cancel / postpone. */
export function EventDetailClient({
  initialEvent,
  viewerTimeZone,
  isAdmin,
}: {
  initialEvent: EventDetail;
  viewerTimeZone: string;
  isAdmin: boolean;
}) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [event, setEvent] = useState<EventDetail>(initialEvent);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);

  const [targetStageId, setTargetStageId] = useState("");
  const [note, setNote] = useState("");
  const [visible, setVisible] = useState(false);

  const readOnly = event.clientStatus === "archived";
  const canMove = !readOnly && event.state === "active";
  const currentStage = event.stages.find((s) => s.id === event.currentStageId);
  const currentName = currentStage?.name ?? "";
  const currentPos = currentStage?.position ?? 0;
  const stageNames = new Map(event.stages.map((s) => [s.id, s.name]));
  const start = describeEventTime(event.startsAt, viewerTimeZone, event.timeZone);
  const end = describeEventTime(event.endsAt, viewerTimeZone, event.timeZone);

  function describe(err: unknown, fallback: string): string {
    if (isApiErrorCode(err, "EVENT_MODIFIED")) {
      setConflict(true);
      return "Someone else changed this event. Reload to see the latest version.";
    }
    if (isApiErrorCode(err, "CLIENT_ARCHIVED")) return "This client is archived and read-only.";
    if (isApiErrorCode(err, "EVENT_NOT_ACTIVE")) return "A cancelled or postponed event can not change stage. Reactivate it first.";
    if (isApiErrorCode(err, "EVENT_STAGE_UNCHANGED")) return "The event is already at that stage.";
    if (isApiErrorCode(err, "EVENT_TIMES_INVALID")) return "Check the times: the end must not be before the start, and an event lasts at most 31 days.";
    return err instanceof Error ? err.message : fallback;
  }

  async function reload() {
    try {
      const { event: fresh } = await eventsApi.get(event.id);
      setEvent(fresh);
      setConflict(false);
      setEditing(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to reload the event", "error");
    }
  }

  async function handleMove(e: React.FormEvent) {
    e.preventDefault();
    if (!targetStageId) return;
    setBusy(true);
    try {
      const { event: saved } = await eventsApi.moveStage(event.id, {
        stageId: targetStageId,
        note: note.trim() || null,
        visibleToClient: visible,
        version: event.version,
      });
      setEvent(saved);
      setTargetStageId("");
      setNote("");
      setVisible(false);
      showToast(`Moved to ${saved.stages.find((x) => x.id === saved.currentStageId)?.name ?? "the new stage"}.`, "success");
    } catch (err) {
      showToast(describe(err, "Failed to move the stage"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(values: EventFormValues): Promise<string | null> {
    try {
      const { event: saved } = await eventsApi.update(event.id, {
        title: values.title,
        type: values.type,
        startsAt: values.startsAt,
        endsAt: values.endsAt,
        timeZone: values.timeZone,
        location: values.location,
        description: values.description,
        ...(values.assignedTeam ? { assignedTeam: values.assignedTeam } : {}),
        version: event.version,
      });
      setEvent(saved);
      setEditing(false);
      setConflict(false);
      showToast("Event saved.", "success");
      return null;
    } catch (err) {
      return describe(err, "Failed to save the event");
    }
  }

  async function changeState(state: "active" | "cancelled" | "postponed") {
    if (state !== "active") {
      const ok = await confirm({
        title: `${state === "cancelled" ? "Cancel" : "Postpone"} ${event.title}?`,
        body: state === "cancelled" ? "The event stays on record but is marked cancelled." : "The event is marked postponed. Reschedule it when a new date is known.",
        confirmLabel: state === "cancelled" ? "Cancel event" : "Postpone",
        danger: state === "cancelled",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const { event: saved } = await eventsApi.update(event.id, { state, version: event.version });
      setEvent(saved);
      showToast(state === "active" ? "Event reactivated." : `Event ${state}.`, "success");
    } catch (err) {
      showToast(describe(err, "Failed to update the event"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">{event.title}</h1>
            <StatusPill label={EVENT_STATE_LABELS[event.state]} tone={EVENT_STATE_TONES[event.state]} />
          </div>
          <p className="text-sm text-text-muted">
            <Link href={`/app/clients/${event.clientId}`} className="underline">
              {event.clientName}
            </Link>{" "}
            · {EVENT_TYPE_LABELS[event.type]} · template {event.templateName}
          </p>
        </div>
        <ButtonLink href={`/app/clients/${event.clientId}`} variant="outline">
          <Icon name="chevron-right" size={15} className="rotate-180" /> Back to client
        </ButtonLink>
      </div>

      {conflict && (
        <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-app border border-error/30 bg-error-bg p-3 text-sm text-error">
          <span>Someone else changed this event.</span>
          <Button variant="outline" onClick={reload}>
            Reload latest
          </Button>
        </div>
      )}
      {readOnly && (
        <div className="mb-4 rounded-app border border-border bg-gray-pill-bg p-3 text-sm text-text-secondary">
          This client is archived, so the event is read-only.
        </div>
      )}

      {editing && !readOnly ? (
        <EventForm
          event={event}
          clientTimeZone={event.timeZone}
          canPickTeam={isAdmin}
          submitLabel="Save changes"
          onSubmit={handleSave}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader icon="🗂" iconTone="purple" title="Progress" subtitle={`Stage ${currentPos} of ${event.stages.length}: ${currentName}`} />
            <CardBody>
              <StageTracker stages={event.stages} currentStageId={event.currentStageId} />
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader icon="📅" iconTone="amber" title="When and where" subtitle={`Viewed in ${viewerTimeZone}`} />
              <CardBody className="flex flex-col gap-2.5">
                <Row label="Starts" value={start.primary} extra={start.secondary} />
                <Row label="Ends" value={end.primary} extra={end.secondary} />
                <Row label="Location" value={event.location} />
                <Row label="Team" value={event.team.length ? event.team.map((t) => t.fullName).join(", ") : null} />
                <Row label="Description" value={event.description} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader icon="📌" iconTone="purple" title="Move stage" subtitle="Forward or back, with a note" />
              <CardBody>
                {canMove ? (
                  <form onSubmit={handleMove} className="flex flex-col gap-3">
                    <div>
                      <FieldLabel htmlFor="mv-stage">Move to</FieldLabel>
                      <Select id="mv-stage" value={targetStageId} onChange={(e) => setTargetStageId(e.target.value)}>
                        <option value="">Choose a stage</option>
                        {event.stages
                          .filter((s) => s.id !== event.currentStageId)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.position}. {s.name}
                            </option>
                          ))}
                      </Select>
                    </div>
                    <div>
                      <FieldLabel htmlFor="mv-note">Note (optional)</FieldLabel>
                      <Textarea id="mv-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-text-primary">
                      <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
                      Visible to the client
                    </label>
                    <Button type="submit" disabled={busy || !targetStageId}>
                      Move stage
                    </Button>
                  </form>
                ) : (
                  <p className="text-sm text-text-muted">
                    {readOnly ? "Read-only while the client is archived." : "Reactivate the event to move its stage."}
                  </p>
                )}
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader icon="🕓" iconTone="amber" title="History" subtitle="Newest first" />
            <CardBody>
              <ol className="flex flex-col gap-3" aria-label="Stage history">
                {event.history.map((h) => (
                  <li key={h.id} className="border-l-2 border-border pl-3">
                    <p className="text-sm text-text-primary">
                      {h.fromStageId ? `${stageNames.get(h.fromStageId) ?? "Stage"} → ${stageNames.get(h.toStageId) ?? "Stage"}` : `Created at ${stageNames.get(h.toStageId) ?? "first stage"}`}
                    </p>
                    <p className="text-xs text-text-muted">
                      {h.changedByName ?? "Unknown"} · {formatDate(h.createdAt)}
                      {h.visibleToClient && " · visible to client"}
                    </p>
                    {h.note && <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{h.note}</p>}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      )}

      {!editing && !readOnly && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => setEditing(true)}>
            <Icon name="edit" size={16} /> Edit or reschedule
          </Button>
          {event.state === "active" ? (
            <>
              <Button variant="outline" disabled={busy} onClick={() => changeState("postponed")}>
                Postpone
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => changeState("cancelled")}>
                <Icon name="ban" size={16} /> Cancel event
              </Button>
            </>
          ) : (
            <Button variant="outline" disabled={busy} onClick={() => changeState("active")}>
              <Icon name="refresh" size={16} /> Reactivate
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, extra }: { label: string; value: string | null; extra?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="break-words text-right text-sm text-text-primary">
        {value || "—"}
        {extra && <span className="block text-xs text-text-muted">{extra}</span>}
      </span>
    </div>
  );
}
