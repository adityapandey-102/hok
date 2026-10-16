import { BadRequestError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { rangeProblem, spanProblem } from "../../../domain";

/**
 * Personal events (FR-CAL-03): visible only to their owner (and the Admin).
 * Pure rules that throw AppError (ADR 0002).
 */

/** personal_events:manage -- the Admin sees every owner's entries, a manager only their own. */
export type PersonalScope = { kind: "all" } | { kind: "own"; userId: string };

export function assertPersonalVisible<T extends { ownerId: string }>(scope: PersonalScope, item: T | null): T {
  if (!item || (scope.kind === "own" && item.ownerId !== scope.userId)) {
    throw new NotFoundError("Personal event not found", ERROR_CODES.PERSONAL_EVENT_NOT_FOUND);
  }
  return item;
}

/**
 * The optional client link must be one of the OWNER's clients: an entry is
 * the owner's, so linking someone else's client would leak it into their
 * calendar. Missing or not theirs -> 404 CLIENT_NOT_FOUND (no existence leak).
 */
export function assertClientLinkable(ownerId: string, client: { ownerId: string } | null): void {
  if (!client || client.ownerId !== ownerId) {
    throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
  }
}

export function assertPersonalTimes(startsAt: string, endsAt: string): void {
  const problem = spanProblem(startsAt, endsAt);
  if (problem) throw new BadRequestError(problem, ERROR_CODES.PERSONAL_EVENT_TIMES_INVALID);
}

export function assertPersonalVersion(current: number, expected: number | undefined): void {
  if (expected !== undefined && current !== expected) {
    throw new ConflictError("This entry was changed elsewhere. Reload and try again.", ERROR_CODES.PERSONAL_EVENT_MODIFIED);
  }
}

/** Both ends or neither; `to` after `from`; at most 92 days. Used by the list and the calendar feed. */
export function resolveCalendarRange(from: string | undefined, to: string | undefined, required = false): { from: string; to: string } | undefined {
  if (from === undefined && to === undefined && !required) return undefined;
  if (from === undefined || to === undefined) {
    throw new BadRequestError(required ? "Send `from` and `to`" : "Send both `from` and `to`, or neither", ERROR_CODES.CALENDAR_RANGE_INVALID);
  }
  const problem = rangeProblem(from, to);
  if (problem) throw new BadRequestError(problem, ERROR_CODES.CALENDAR_RANGE_INVALID);
  return { from, to };
}
