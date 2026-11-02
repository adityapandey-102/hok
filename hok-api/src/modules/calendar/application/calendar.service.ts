import type { Role } from "../../../domain";
import { CALENDAR_MAX_ITEMS_PER_KIND, type CalendarItem } from "../domain/calendar.entity";
import { assertFeedRange, mergeByStart, resolveCalendarScope } from "../domain/calendar.rules";
import type { CalendarRepositoryPort } from "./ports/calendar-repository.port";
import type { CalendarQueryDto } from "../api/dto/calendar-query.dto";

export interface CalendarFeed {
  from: string;
  to: string;
  items: CalendarItem[];
  /** True when any kind hit CALENDAR_MAX_ITEMS_PER_KIND: narrow the range or filter. */
  truncated: boolean;
}

/**
 * The merged calendar feed (FR-CAL-01/02/06): client events, personal entries,
 * tasks and the caller's own to-dos overlapping a range, in at most FOUR
 * queries (one per kind, run in parallel), each capped; merged by start time
 * here. Times stay UTC: the web shows them in the viewer's zone and each
 * item's own `timeZone` when it differs (FR-CAL-07).
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
    // Event-only filters (type, state) leave out every other kind: they have neither.
    const eventOnly = query.eventType !== undefined || query.state !== undefined;
    const wants = (kind: "events" | "personal" | "tasks" | "todos") =>
      (query.include === "all" || query.include === kind) && (kind === "events" || !eventOnly);
    // One extra row tells us whether the cap was hit.
    const limit = this.maxPerKind + 1;

    const [events, personal, tasks, todos] = await Promise.all([
      wants("events") && scope.events
        ? this.repo.eventsInRange(range, { ...scope.events, clientId: query.clientId, eventType: query.eventType, state: query.state }, limit)
        : Promise.resolve([]),
      wants("personal") && scope.personal
        ? this.repo.personalInRange(range, { ownerId: scope.personal.ownerId, clientId: query.clientId }, limit)
        : Promise.resolve([]),
      wants("tasks") ? this.repo.tasksInRange(range, { scope: scope.tasks, clientId: query.clientId }, limit) : Promise.resolve([]),
      // To-dos have no client: a client filter leaves them out.
      wants("todos") && query.clientId === undefined ? this.repo.todosInRange(range, scope.todos, limit) : Promise.resolve([]),
    ]);
    const truncated = [events, personal, tasks, todos].some((rows) => rows.length > this.maxPerKind);
    return {
      from: query.from,
      to: query.to,
      items: mergeByStart(
        events.slice(0, this.maxPerKind),
        personal.slice(0, this.maxPerKind),
        tasks.slice(0, this.maxPerKind),
        todos.slice(0, this.maxPerKind),
      ),
      truncated,
    };
  }
}
