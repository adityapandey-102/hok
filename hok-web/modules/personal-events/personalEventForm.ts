import { isoToZonedInput, zonedWallTimeToIso } from "../../lib/domain";
import type { CreatePersonalEventPayload, PersonalEvent } from "./api/personalEventsApi";

export interface PersonalEventFormValues {
  title: string;
  start: string;
  end: string;
  description: string;
  clientId: string;
}

/** Defaults for a new entry on a day: 09:00-10:00 wall time. */
export function emptyValues(day?: string): PersonalEventFormValues {
  return { title: "", start: day ? `${day}T09:00` : "", end: day ? `${day}T10:00` : "", description: "", clientId: "" };
}

export function valuesFromEvent(e: PersonalEvent, zone: string): PersonalEventFormValues {
  return {
    title: e.title,
    start: isoToZonedInput(e.startsAt, zone),
    end: isoToZonedInput(e.endsAt, zone),
    description: e.description ?? "",
    clientId: e.clientId ?? "",
  };
}

/** Validates the form and builds the API payload (instants carry the viewer-zone offset). Returns an error string or the payload. */
export function toPayload(v: PersonalEventFormValues, zone: string): { error: string } | { payload: CreatePersonalEventPayload } {
  const title = v.title.trim();
  if (!title) return { error: "Enter a title." };
  const startsAt = zonedWallTimeToIso(v.start, zone);
  const endsAt = zonedWallTimeToIso(v.end, zone);
  if (!startsAt || !endsAt) return { error: "Enter a start and an end time." };
  const span = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  if (span < 0) return { error: "The end must be after the start." };
  if (span > 31 * 86_400_000) return { error: "An entry can last at most 31 days." };
  return {
    payload: {
      title,
      startsAt,
      endsAt,
      timeZone: zone,
      description: v.description.trim() || null,
      clientId: v.clientId || null,
    },
  };
}
