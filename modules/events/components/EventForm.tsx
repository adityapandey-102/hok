"use client";

import { useState } from "react";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  isValidTimeZone,
  isoToZonedInput,
  zonedWallTimeToIso,
  type EventDetail,
  type EventType,
  type StageTemplate,
} from "../../../lib/domain";
import type { UserAccount } from "../../admin-users/api/usersApi";
import { TimeZoneInput } from "../../admin-users/components/TimeZoneInput";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Select, Textarea } from "../../../components/ui/Select";

export interface EventFormValues {
  templateId?: string;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  location: string | null;
  description: string | null;
  assignedTeam: string[] | undefined;
}

/**
 * Create / edit / reschedule form. Start and end are typed as wall-clock times
 * in the chosen event time zone and sent as ISO instants with that zone offset.
 * Create needs `templates` (active ones) and shows the template picker; edit
 * never changes the template. `staff` (Admin only) enables the team picker.
 */
export function EventForm({
  event,
  clientTimeZone,
  defaultDate,
  templates,
  staff,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  event?: EventDetail;
  clientTimeZone: string;
  /** YYYY-MM-DD to prefill a new event (a clicked calendar day): 09:00 to 10:00. */
  defaultDate?: string;
  templates?: StageTemplate[];
  staff?: UserAccount[];
  submitLabel: string;
  onSubmit: (values: EventFormValues) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState<EventType>(event?.type ?? "shoot");
  const [templateId, setTemplateId] = useState(templates?.[0]?.id ?? "");
  const [timeZone, setTimeZone] = useState(event?.timeZone ?? clientTimeZone);
  const [start, setStart] = useState(event ? isoToZonedInput(event.startsAt, event.timeZone) : defaultDate ? `${defaultDate}T09:00` : "");
  const [end, setEnd] = useState(event ? isoToZonedInput(event.endsAt, event.timeZone) : defaultDate ? `${defaultDate}T10:00` : "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [team, setTeam] = useState<string[]>(event?.assignedTeam ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Please enter a title.");
    if (!event && !templateId) return setError("Pick a stage template.");
    const zone = timeZone.trim();
    if (!isValidTimeZone(zone)) return setError("Enter a valid time zone, e.g. Asia/Kolkata.");
    const startsAt = zonedWallTimeToIso(start, zone);
    const endsAt = zonedWallTimeToIso(end, zone);
    if (!startsAt || !endsAt) return setError("Enter both a start and an end time.");
    if (new Date(endsAt) < new Date(startsAt)) return setError("The end can not be before the start.");

    setSaving(true);
    const message = await onSubmit({
      templateId: event ? undefined : templateId,
      title: title.trim(),
      type,
      startsAt,
      endsAt,
      timeZone: zone,
      location: location.trim() || null,
      description: description.trim() || null,
      assignedTeam: staff ? team : undefined,
    });
    setSaving(false);
    if (message) setError(message);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-app-lg border border-border bg-card p-5 shadow-app">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldLabel required htmlFor="ev-title">
            Title
          </FieldLabel>
          <Input id="ev-title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="ev-type">Type</FieldLabel>
          <Select id="ev-type" value={type} onChange={(e) => setType(e.target.value as EventType)}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        {!event && (
          <div>
            <FieldLabel required htmlFor="ev-template">
              Stage template
            </FieldLabel>
            <Select id="ev-template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              {(templates ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.stages.length} stages)
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <FieldLabel htmlFor="ev-tz">Event time zone</FieldLabel>
          <TimeZoneInput id="ev-tz" value={timeZone} onChange={setTimeZone} />
        </div>
        <div />
        <div>
          <FieldLabel required htmlFor="ev-start">
            Starts ({timeZone || "time zone"})
          </FieldLabel>
          <Input id="ev-start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <FieldLabel required htmlFor="ev-end">
            Ends ({timeZone || "time zone"})
          </FieldLabel>
          <Input id="ev-end" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="ev-location">Location or link</FieldLabel>
          <Input id="ev-location" value={location} maxLength={500} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel htmlFor="ev-description">Description</FieldLabel>
          <Textarea id="ev-description" rows={3} value={description} maxLength={5000} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {staff && staff.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-text-secondary">Team (optional)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {staff.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={team.includes(u.id)}
                  onChange={(e) => setTeam((t) => (e.target.checked ? [...t, u.id] : t.filter((id) => id !== u.id)))}
                />
                {u.fullName}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <FieldError>{error}</FieldError>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : submitLabel}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
