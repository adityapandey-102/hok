import { apiFetch } from "../../../lib/api/client";

export interface PersonalEvent {
  id: string;
  ownerId: string;
  ownerName: string;
  clientId: string | null;
  clientName: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  description: string | null;
  version: number;
}

export interface CreatePersonalEventPayload {
  title: string;
  startsAt: string;
  endsAt: string;
  timeZone?: string;
  description?: string | null;
  clientId?: string | null;
}

export interface UpdatePersonalEventPayload extends Partial<CreatePersonalEventPayload> {
  version: number;
}

export const personalEventsApi = {
  get(id: string): Promise<{ personalEvent: PersonalEvent }> {
    return apiFetch(`/personal-events/${id}`);
  },
  create(payload: CreatePersonalEventPayload): Promise<{ personalEvent: PersonalEvent }> {
    return apiFetch("/personal-events", { method: "POST", body: JSON.stringify(payload) });
  },
  update(id: string, payload: UpdatePersonalEventPayload): Promise<{ personalEvent: PersonalEvent }> {
    return apiFetch(`/personal-events/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  remove(id: string): Promise<void> {
    return apiFetch(`/personal-events/${id}`, { method: "DELETE" });
  },
};
