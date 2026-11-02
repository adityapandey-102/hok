import { BadRequestError, ForbiddenError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { getCapabilityScope, hasCapability, rangeProblem, type Role } from "../../../domain";
import type { CalendarItem, CalendarScope } from "./calendar.entity";

/**
 * The merged calendar feed (REQUIREMENTS §5.6). Everyone has a calendar; what
 * is in it depends on the role:
 *  - events (events:read): a manager sees the clients whose team they're on
 *    (FR-CAL-02; an `ownerId` filter is ignored); the Admin sees every client
 *    event (FR-CAL-06), narrowed by `ownerId` if given; task-only staff: none;
 *  - personal entries (personal_events:manage): the caller's own; the Admin's
 *    are `ownerId`'s if given, else the Admin's own -- other managers' private
 *    entries don't flood the global view unless asked for;
 *  - tasks (everyone): the staff-task visibility rule -- the Admin all (narrowed
 *    to an assignee by `ownerId`), everyone else the tasks assigned to or
 *    created by them and, client managers only, their clients';
 *  - to-dos (everyone): always and only the caller's own, whatever `ownerId` says.
 */
export function resolveCalendarScope(caller: { userId: string; role: Role }, ownerId: string | undefined): CalendarScope {
  const events = getCapabilityScope(caller.role, "events:read");
  const personal = getCapabilityScope(caller.role, "personal_events:manage");
  const tasks = getCapabilityScope(caller.role, "staff_tasks:read");
  if (tasks === false) throw new ForbiddenError("Your role has no calendar");
  const admin = events === true;
  const mine = { ownerId: caller.userId };
  return {
    events: events === false ? null : admin ? { ownerId } : mine,
    personal: personal === false ? null : admin ? { ownerId: ownerId ?? caller.userId } : mine,
    tasks:
      tasks === true
        ? { kind: "all", assigneeId: ownerId }
        : { kind: "own", userId: caller.userId, viaTeam: hasCapability(caller.role, "clients:read") },
    todos: mine,
  };
}

/** The feed always needs a range: both ends, `to` after `from`, at most 92 days. */
export function assertFeedRange(from: string, to: string): void {
  const problem = rangeProblem(from, to);
  if (problem) throw new BadRequestError(problem, ERROR_CODES.CALENDAR_RANGE_INVALID);
}

/** Merge the per-kind lists into one, by start, then end, then kind/id for a stable order. */
export function mergeByStart(...lists: CalendarItem[][]): CalendarItem[] {
  return lists
    .flat()
    .sort((x, y) => x.startsAt.localeCompare(y.startsAt) || x.endsAt.localeCompare(y.endsAt) || x.kind.localeCompare(y.kind) || x.id.localeCompare(y.id));
}
