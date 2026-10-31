import { BadRequestError, ForbiddenError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { getCapabilityScope, rangeProblem, type Role } from "../../../domain";
import type { CalendarItem, CalendarScope } from "./calendar.entity";

/**
 * The merged calendar feed (REQUIREMENTS §5.6). Who sees what:
 *  - a manager: events of the clients whose team they're on + their own personal entries
 *    (FR-CAL-02); an `ownerId` filter is ignored;
 *  - the Admin: every client event (FR-CAL-06), narrowed by `ownerId` if
 *    given; personal entries of `ownerId` if given, else the Admin's own --
 *    other managers' private entries don't flood the global view unless asked for;
 *  - task-only staff: no calendar (403).
 */
export function resolveCalendarScope(caller: { userId: string; role: Role }, ownerId: string | undefined): CalendarScope {
  const events = getCapabilityScope(caller.role, "events:read");
  const personal = getCapabilityScope(caller.role, "personal_events:manage");
  if (events === false) throw new ForbiddenError("Your role has no calendar");
  if (events === "own") return { events: { ownerId: caller.userId }, personal: personal === false ? null : { ownerId: caller.userId } };
  return { events: { ownerId }, personal: personal === false ? null : { ownerId: ownerId ?? caller.userId } };
}

/** The feed always needs a range: both ends, `to` after `from`, at most 92 days. */
export function assertFeedRange(from: string, to: string): void {
  const problem = rangeProblem(from, to);
  if (problem) throw new BadRequestError(problem, ERROR_CODES.CALENDAR_RANGE_INVALID);
}

/** Merge two already-sorted lists into one, by start, then end, then kind/id for a stable order. */
export function mergeByStart(a: CalendarItem[], b: CalendarItem[]): CalendarItem[] {
  return [...a, ...b].sort(
    (x, y) => x.startsAt.localeCompare(y.startsAt) || x.endsAt.localeCompare(y.endsAt) || x.kind.localeCompare(y.kind) || x.id.localeCompare(y.id),
  );
}
