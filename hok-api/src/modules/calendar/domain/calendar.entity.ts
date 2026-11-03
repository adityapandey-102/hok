import type { EventState, EventType } from "../../events/domain/event.entity";
import type { StaffTaskPriority, StaffTaskStatus } from "../../staff-tasks/domain/staff-task.entity";
import type { TodoUrgency } from "../../todos/domain/todo.entity";

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

/**
 * A staff task, placed at its due instant (round 1). `startsAt` = `endsAt` = due_at;
 * `timeZone` is "UTC" because the task has none of its own (the web shows it in the
 * viewer's zone). `ownerId` is the assignee; the client may be null.
 */
export interface CalendarTaskItem extends CalendarItemBase {
  kind: "task";
  status: StaffTaskStatus;
  priority: StaffTaskPriority;
  assigneeId: string;
  assigneeName: string;
  /** Where the task is in its own stages (round 2), e.g. "Rough cut", 2 of 5. */
  currentStageName: string;
  currentStagePosition: number;
  stageCount: number;
}

/** One of the caller's own to-dos with a due date, placed at its due instant. Never anyone else's. No client. */
export interface CalendarTodoItem extends CalendarItemBase {
  kind: "todo";
  urgency: TodoUrgency;
  done: boolean;
}

export type CalendarItem = CalendarEventItem | CalendarPersonalItem | CalendarTaskItem | CalendarTodoItem;

/** Which staff tasks the feed reads: all (Admin; optionally one assignee), or the ones this person may see. */
export type CalendarTaskScope =
  | { kind: "all"; assigneeId?: string }
  | { kind: "own"; userId: string; viaTeam: boolean };

/**
 * Translates the caller's capabilities into what the feed reads. A null part is
 * not read at all: client events (events:read), personal entries
 * (personal_events:manage). Tasks follow the staff-task visibility rule. To-dos
 * are always and only the caller's own. `ownerId` undefined = every owner (Admin, events only).
 */
export interface CalendarScope {
  events: { ownerId?: string } | null;
  personal: { ownerId: string } | null;
  tasks: CalendarTaskScope;
  todos: { ownerId: string };
}
