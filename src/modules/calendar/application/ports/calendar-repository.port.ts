import type { EventState, EventType } from "../../../events/domain/event.entity";
import type { CalendarEventItem, CalendarPersonalItem } from "../../domain/calendar.entity";

export interface CalendarRange {
  from: string;
  to: string;
}

export interface CalendarEventFilters {
  ownerId?: string;
  clientId?: string;
  eventType?: EventType;
  state?: EventState;
}

export interface CalendarPersonalFilters {
  ownerId: string;
  clientId?: string;
}

/** Read-only, range-bounded reads for the feed: one query per kind, at most `limit` rows each, earliest first. */
export interface CalendarRepositoryPort {
  eventsInRange(range: CalendarRange, filters: CalendarEventFilters, limit: number): Promise<CalendarEventItem[]>;
  personalInRange(range: CalendarRange, filters: CalendarPersonalFilters, limit: number): Promise<CalendarPersonalItem[]>;
}
