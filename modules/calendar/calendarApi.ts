import { apiFetch } from "../../lib/api/client";
import type { EventType } from "../../lib/domain";
import type { FeedResult } from "./calendarItems";

export interface CalendarFeedFilters {
  from: string;
  to: string;
  include?: "all" | "events" | "personal";
  clientId?: string;
  ownerId?: string;
  eventType?: EventType;
}

export const calendarApi = {
  feed(filters: CalendarFeedFilters): Promise<FeedResult> {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") q.set(key, String(value));
    }
    return apiFetch(`/calendar?${q.toString()}`);
  },
};
