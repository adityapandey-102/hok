import type { Role } from "../../../domain";
import { CALENDAR_MAX_ITEMS_PER_KIND, type CalendarItem } from "../domain/calendar.entity";
import { assertFeedRange, mergeByStart, resolveCalendarScope } from "../domain/calendar.rules";
import type { CalendarRepositoryPort } from "./ports/calendar-repository.port";
import type { CalendarQueryDto } from "../api/dto/calendar-query.dto";

export interface CalendarFeed {
  from: string;
  to: string;
  items: CalendarItem[];
  /** True when either kind hit CALENDAR_MAX_ITEMS_PER_KIND: narrow the range or filter. */
  truncated: boolean;
}

/**
 * The merged calendar feed (FR-CAL-01/02/06): client events + personal
 * entries overlapping a range, in at most TWO queries (one per kind, run in
 * parallel), each capped; merged by start time here. Times stay UTC: the web
 * shows them in the viewer's zone and each item's own `timeZone` when it
 * differs (FR-CAL-07).
 */
export class CalendarService {
  constructor(
    private readonly repo: CalendarRepositoryPort,
    private readonly maxPerKind = CALENDAR_MAX_ITEMS_PER_KIND,
  ) {}

  async feed(caller: { userId: string; role: Role }, query: CalendarQueryDto): Promise<CalendarFeed> {
    assertFeedRange(query.from, query.to);
    const scope = resolveCalendarScope(caller, query.ownerId);
    const range = { from: query.from, to: query.to };
    const wantEvents = query.include !== "personal";
    const wantPersonal = query.include !== "events" && scope.personal !== null;
    // Event-only filters exclude personal entries (they have no type or state).
    const personalApplies = wantPersonal && query.eventType === undefined && query.state === undefined;
    // One extra row tells us whether the cap was hit.
    const limit = this.maxPerKind + 1;

    const [events, personal] = await Promise.all([
      wantEvents
        ? this.repo.eventsInRange(range, { ...scope.events, clientId: query.clientId, eventType: query.eventType, state: query.state }, limit)
        : Promise.resolve([]),
      personalApplies && scope.personal
        ? this.repo.personalInRange(range, { ownerId: scope.personal.ownerId, clientId: query.clientId }, limit)
        : Promise.resolve([]),
    ]);
    const truncated = events.length > this.maxPerKind || personal.length > this.maxPerKind;
    return {
      from: query.from,
      to: query.to,
      items: mergeByStart(events.slice(0, this.maxPerKind), personal.slice(0, this.maxPerKind)),
      truncated,
    };
  }
}
