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
} from "../../../lib/domain";
import type { SelectOption } from "../../../lib/api/options";
import { teamMembersApi } from "../../team-members/api/teamMembersApi";
import { templatesApi } from "../../stage-templates/api/templatesApi";
import { TimeZoneInput } from "../../admin-users/components/TimeZoneInput";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel, Input } from "../../../components/ui/Field";
import { Select, Textarea } from "../../../components/ui/Select";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { Icon } from "../../../components/ui/Icon";

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
 * Create shows the template picker (searched on the server; `defaultTemplate`
 * is the preselected one); edit never changes the template. `canPickTeam`
 * (Admin only) enables the team picker, also searched on the server.
 */
export function EventForm({
  event,
  clientTimeZone,
  defaultDate,
  defaultTemplate,
  canPickTeam = false,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  event?: EventDetail;
  clientTimeZone: string;
  /** YYYY-MM-DD to prefill a new event (a clicked calendar day): 09:00 to 10:00. */
  defaultDate?: string;
  defaultTemplate?: SelectOption;
  canPickTeam?: boolean;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState<EventType>(event?.type ?? "shoot");
  const [templateId, setTemplateId] = useState(defaultTemplate?.id ?? "");
  const [timeZone, setTimeZone] = useState(event?.timeZone ?? clientTimeZone);
  const [start, setStart] = useState(event ? isoToZonedInput(event.startsAt, event.timeZone) : defaultDate ? `${defaultDate}T09:00` : "");
  const [end, setEnd] = useState(event ? isoToZonedInput(event.endsAt, event.timeZone) : defaultDate ? `${defaultDate}T10:00` : "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [team, setTeam] = useState<string[]>(event?.assignedTeam ?? []);
  // Display names for the team chips: the event's own team list, plus each new pick.
  const [teamNames, setTeamNames] = useState<Record<string, string>>(() => Object.fromEntries((event?.team ?? []).map((m) => [m.id, m.fullName])));
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
      assignedTeam: canPickTeam ? team : undefined,
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
            <SearchSelect
              id="ev-template"
              placeholder="Search stage templates…"
              value={templateId || null}
              selectedLabel={defaultTemplate?.id === templateId ? defaultTemplate.label : undefined}
              load={templatesApi.searchActiveOptions}
              onChange={(id) => setTemplateId(id ?? "")}
            />
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

      {canPickTeam && (
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-text-secondary">Team (optional)</legend>
          {team.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {team.map((id) => (
                <li key={id} className="inline-flex items-center gap-1 rounded-full bg-primary-bg py-1 pl-3 pr-1.5 text-sm text-text-primary">
                  {teamNames[id] ?? "Team member"}
                  <button
                    type="button"
                    aria-label={`Remove ${teamNames[id] ?? "team member"}`}
                    onClick={() => setTeam((t) => t.filter((x) => x !== id))}
                    className="rounded-full p-0.5 text-text-muted hover:text-text-primary"
                  >
                    <Icon name="x" size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <SearchSelect
            id="ev-team"
            aria-label="Add a team member"
            placeholder="Search people to add…"
            clearOnSelect
            value={null}
            excludeIds={team}
            load={(q) => teamMembersApi.searchOptions(q)}
            onChange={(id, item) => {
              if (!id || !item) return;
              setTeam((t) => (t.includes(id) ? t : [...t, id]));
              setTeamNames((n) => ({ ...n, [id]: item.label }));
            }}
          />
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
