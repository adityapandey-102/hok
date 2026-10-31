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
import { Button } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { Card } from "../../../components/ui/Card";
import { Panel } from "../../../components/ui/Panel";
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

  const share = event.stages.length > 0 ? Math.round((currentPos / event.stages.length) * 100) : 0;
  const manageable = !editing && !readOnly;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex flex-col gap-3">
        <Link
          href={`/app/clients/${event.clientId}`}
          className="-ml-1 inline-flex w-fit max-w-full items-center gap-0.5 rounded-app-sm px-1 text-[15px] font-medium text-primary hover:opacity-75 focus-visible:ring-4 focus-visible:ring-ring/25 focus-visible:outline-none"
        >
          <Icon name="chevron-left" size={17} className="shrink-0" /> <span className="truncate">{event.clientName}</span>
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
            <h1 className="page-title break-words">{event.title}</h1>
            <span className="mt-2.5 lg:mt-3.5"><StatusPill label={EVENT_STATE_LABELS[event.state]} tone={EVENT_STATE_TONES[event.state]} /></span>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-text-secondary">
            <li className="flex min-w-0 items-center gap-1.5">
              <Icon name="briefcase" size={14} className="shrink-0 text-text-muted" />
              <Link href={`/app/clients/${event.clientId}`} className="truncate font-medium text-primary underline-offset-2 hover:underline">
                {event.clientName}
              </Link>
            </li>
            <li className="flex items-center gap-1.5">
              <Icon name="tag" size={14} className="shrink-0 text-text-muted" />
              {EVENT_TYPE_LABELS[event.type]}
            </li>
            <li className="flex min-w-0 items-center gap-1.5">
              <Icon name="layers" size={14} className="shrink-0 text-text-muted" />
              <span className="truncate">Template {event.templateName}</span>
            </li>
          </ul>
        </div>
      </header>

      {conflict && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-app border border-error/30 bg-error-bg p-3 text-sm text-error">
          <span>Someone else changed this event.</span>
          <Button variant="outline" onClick={reload}>
            Reload latest
          </Button>
        </div>
      )}
      {readOnly && (
        <div className="flex items-center gap-2 rounded-app border border-border bg-gray-pill-bg p-3 text-sm text-text-secondary">
          <Icon name="lock" size={15} className="shrink-0" /> This client is archived, so the event is read-only.
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
        <>
          <Card accent className="overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 pt-5 pb-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs text-text-muted">
                  Stage {currentPos} of {event.stages.length}
                </p>
                <h2 className="mt-1 font-serif text-2xl leading-tight break-words text-text-primary sm:text-[28px]">{currentName}</h2>
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
              <StageTracker stages={event.stages} currentStageId={event.currentStageId} />
            </div>
          </Card>

          <div className="grid grid-cols-1 items-start gap-x-6 gap-y-7 lg:grid-cols-12">
            <Panel icon="calendar" title="When and where" subtitle={`Times in ${viewerTimeZone}`} className="lg:col-span-7">
              <dl className="inset-rows">
                <Row label="Starts" value={start.primary} extra={start.secondary} />
                <Row label="Ends" value={end.primary} extra={end.secondary} />
                {event.location && <Row label="Location" value={event.location} />}
                {event.team.length > 0 && <Row label="Team" value={event.team.map((t) => t.fullName).join(", ")} />}
                {event.description && <Row label="Description" value={event.description} />}
              </dl>
            </Panel>

            <Panel icon="send" title="Move stage" subtitle="Forward or back, with a note" className="lg:col-span-5">
              <div className="border-t border-border-light p-5">
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
                    <label className="flex min-h-10 items-center gap-2 text-sm text-text-primary">
                      <input type="checkbox" className="h-4 w-4 accent-primary" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
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
              </div>
            </Panel>
          </div>

          <Panel icon="history" title="History" subtitle="Every stage change, newest first">
            <ol className="border-t border-border-light px-5 py-5 sm:px-6" aria-label="Stage history">
              {event.history.map((h, i) => (
                <li key={h.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < event.history.length - 1 && <span aria-hidden className="absolute top-7 bottom-0 left-[11px] w-px bg-border" />}
                  <span
                    aria-hidden
                    className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-4 ring-card ${i === 0 ? "bg-primary text-white" : "bg-accent-bg text-text-secondary"}`}
                  >
                    <Icon name={i === 0 ? "check" : "layers"} size={12} strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium break-words text-text-primary">
                      {h.fromStageId ? `${stageNames.get(h.fromStageId) ?? "Stage"} → ${stageNames.get(h.toStageId) ?? "Stage"}` : `Created at ${stageNames.get(h.toStageId) ?? "first stage"}`}
                    </p>
                    <p className="text-xs text-text-muted">
                      {h.changedByName ?? "Unknown"} · {formatDate(h.createdAt)}
                      {h.visibleToClient && " · visible to client"}
                    </p>
                    {h.note && (
                      <p className="mt-2 rounded-app bg-accent-bg px-3 py-2 text-sm break-words whitespace-pre-wrap text-text-secondary">{h.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        </>
      )}

      {manageable && (
        <Panel icon="settings" title="Manage event" subtitle="Reschedule, pause or cancel">
          <div className="flex flex-col gap-2 border-t border-border-light p-5 sm:flex-row sm:flex-wrap">
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
        </Panel>
      )}
    </div>
  );
}

/** A list row: label left, value right. Empty fields aren't drawn at all. */
function Row({ label, value, extra }: { label: string; value: string; extra?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <dt className="shrink-0 text-[15px] text-text-primary">{label}</dt>
      <dd className="min-w-0 text-right text-[15px] break-words text-text-secondary">
        {value}
        {extra && <span className="block text-xs text-text-muted">{extra}</span>}
      </dd>
    </div>
  );
}
