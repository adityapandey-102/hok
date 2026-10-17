import type { EventDetail, EventState, EventSummary, EventType } from "../../../lib/domain";
import { apiFetch } from "../../../lib/api/client";
import { SEARCH_SELECT_LIMIT, type SelectOption } from "../../../lib/api/options";

export interface EventListFilters {
  clientId?: string;
  state?: EventState;
  type?: EventType;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface EventListResult {
  events: EventSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateEventPayload {
  clientId: string;
  templateId: string;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  timeZone?: string;
  location?: string | null;
  description?: string | null;
  assignedTeam?: string[];
}

export interface UpdateEventPayload {
  title?: string;
  type?: EventType;
  startsAt?: string;
  endsAt?: string;
  timeZone?: string;
  location?: string | null;
  description?: string | null;
  assignedTeam?: string[];
  state?: EventState;
  version: number;
}

export const eventsApi = {
  list(filters: EventListFilters = {}): Promise<EventListResult> {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") q.set(key, String(value));
    }
    return apiFetch(`/events?${q.toString()}`);
  },

  /** SearchSelect loader: one client's events matching `search`, newest first, at most 20. */
  async searchOptions(clientId: string, search: string): Promise<SelectOption<EventSummary>[]> {
    const page = await eventsApi.list({ clientId, search: search || undefined, limit: SEARCH_SELECT_LIMIT, offset: 0 });
    return page.events.map((e) => ({ id: e.id, label: e.title, hint: new Date(e.startsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }), data: e }));
  },

  get(id: string): Promise<{ event: EventDetail }> {
    return apiFetch(`/events/${id}`);
  },

  create(payload: CreateEventPayload): Promise<{ event: EventDetail }> {
    return apiFetch("/events", { method: "POST", body: JSON.stringify(payload) });
  },

  update(id: string, payload: UpdateEventPayload): Promise<{ event: EventDetail }> {
    return apiFetch(`/events/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },

  moveStage(
    id: string,
    payload: { stageId: string; note?: string | null; visibleToClient?: boolean; version: number },
  ): Promise<{ event: EventDetail }> {
    return apiFetch(`/events/${id}/stage`, { method: "POST", body: JSON.stringify(payload) });
  },
};
