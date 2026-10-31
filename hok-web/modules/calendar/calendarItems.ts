import type { EventState, EventSummary, EventType } from "../../lib/domain";

/**
 * What the calendar draws. Client events map onto it today; personal events
 * (M5 API, a distinct style) slot in later by adding another `from...`
 * mapper with kind "personal" and no client, stage or href to an event page.
 */
export interface CalendarItem {
  id: string;
  kind: "event" | "personal";
  title: string;
  startsAt: string;
  endsAt: string;
  /** The item own IANA zone, for the event-local time in tooltips. */
  timeZone: string;
  href: string;
  type: EventType | "personal";
  state: EventState;
  clientId: string | null;
  clientName: string | null;
  stageName: string | null;
}

export function fromEvent(e: EventSummary): CalendarItem {
  return {
    id: e.id,
    kind: "event",
    title: e.title,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    timeZone: e.timeZone,
    href: `/app/events/${e.id}`,
    type: e.type,
    state: e.state,
    clientId: e.clientId,
    clientName: e.clientName,
    stageName: e.currentStageName,
  };
}

/**
 * Chip styles. Client work is a neutral tint (crimson is kept for today's date
 * marker); personal entries are outlined and transparent so they never read as
 * client work. The map stays keyed by type so a type can get its own look later.
 */
const CLIENT_CHIP = "bg-accent-bg text-text-primary border-border border-l-[3px] border-l-ink";
export const TYPE_CHIP_CLASSES: Record<CalendarItem["type"], string> = {
  shoot: CLIENT_CHIP,
  campaign: CLIENT_CHIP,
  meeting: CLIENT_CHIP,
  content_posting: CLIENT_CHIP,
  other: CLIENT_CHIP,
  personal: "bg-transparent text-text-secondary border-dashed border-text-muted",
};

/** One item of GET /calendar (client events and personal entries merged). */
export interface FeedItem {
  kind: "event" | "personal";
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  clientId: string | null;
  clientName: string | null;
  ownerId: string;
  eventType?: EventType;
  state?: EventState;
  currentStageName?: string;
}

export interface FeedResult {
  from: string;
  to: string;
  truncated: boolean;
  items: FeedItem[];
}

export function fromFeedItem(f: FeedItem): CalendarItem {
  const personal = f.kind === "personal";
  return {
    id: f.id,
    kind: f.kind,
    title: f.title,
    startsAt: f.startsAt,
    endsAt: f.endsAt,
    timeZone: f.timeZone,
    href: personal ? "" : `/app/events/${f.id}`,
    type: personal ? "personal" : (f.eventType ?? "other"),
    state: f.state ?? "active",
    clientId: f.clientId,
    clientName: f.clientName,
    stageName: personal ? null : (f.currentStageName ?? null),
  };
}
