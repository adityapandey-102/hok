import type { Role } from "../../../../domain";
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

/** The person a subscribe link belongs to: active people only. */
export interface FeedOwner {
  userId: string;
  role: Role;
  fullName: string;
}

/** The caller's own subscribe link (FR-CAL-08): only the token's hash is stored. */
export interface CalendarFeedRepositoryPort {
  feedLink(userId: string): Promise<{ createdAt: string } | null>;
  /** Replace the hash (null turns the link off); returns the link as it now stands. */
  setFeedLink(userId: string, tokenHash: string | null): Promise<{ createdAt: string } | null>;
  findFeedOwner(tokenHash: string): Promise<FeedOwner | null>;
}
