import type { EventState, EventType } from "../../events/domain/event.entity";

/** Most items of EACH kind one feed returns; past it the response says `truncated`. */
export const CALENDAR_MAX_ITEMS_PER_KIND = 500;

/** Fields every calendar item has, whatever its kind. Instants are UTC ISO; `timeZone` is the item's own IANA zone. */
interface CalendarItemBase {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  clientId: string | null;
  clientName: string | null;
  ownerId: string;
}

/** A client event (FR-CAL-01/02/06): colour by client or type, filter by stage. */
export interface CalendarEventItem extends CalendarItemBase {
  kind: "event";
  clientId: string;
  clientName: string;
  eventType: EventType;
  state: EventState;
  currentStageName: string;
  currentStagePosition: number;
  stageCount: number;
}

/** A manager's own entry (FR-CAL-02/03). */
export interface CalendarPersonalItem extends CalendarItemBase {
  kind: "personal";
}

export type CalendarItem = CalendarEventItem | CalendarPersonalItem;

/**
 * Translates the caller's two capabilities into what the feed reads:
 * client events (events:read) and personal entries (personal_events:manage).
 * `ownerId` undefined = every owner (Admin, events only).
 */
export interface CalendarScope {
  events: { ownerId?: string };
  personal: { ownerId: string } | null;
}
