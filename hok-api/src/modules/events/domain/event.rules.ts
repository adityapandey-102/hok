import { BadRequestError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { rangeProblem, spanProblem } from "../../../domain";
import type { EventStage, EventState } from "./event.entity";

/**
 * Event rules (FR-EVT-02..07). Pure functions that throw AppError (ADR 0002).
 * An event inherits its client's row scope: a manager sees only events of
 * clients they own; anything else is a 404.
 */

/** Same shape as the Clients module's scope (kept local: domains don't import each other, ADR 0003). */
export type EventScope = { kind: "all" } | { kind: "own"; userId: string };

/** The client a new event goes under, as stored. */
export interface EventClient {
  id: string;
  /** The client's team: a manager may use the client only while on it. */
  teamIds: string[];
  status: "active" | "paused" | "archived";
  timeZone: string;
}

/** The template a new event is created from. */
export interface EventTemplate {
  id: string;
  name: string;
  active: boolean;
  stageNames: string[];
}

export function assertEventVisible<T extends { teamIds: readonly string[] }>(scope: EventScope, event: T | null): T {
  if (!event || (scope.kind === "own" && !event.teamIds.includes(scope.userId))) {
    throw new NotFoundError("Event not found", ERROR_CODES.EVENT_NOT_FOUND);
  }
  return event;
}

/** The client for a new event: must be visible (else 404 CLIENT_NOT_FOUND) and not archived (409 CLIENT_ARCHIVED). */
export function assertClientUsable(scope: EventScope, client: EventClient | null): EventClient {
  if (!client || (scope.kind === "own" && !client.teamIds.includes(scope.userId))) {
    throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
  }
  assertClientWritable(client.status);
  return client;
}

/** An archived client's events are read-only until the client is unarchived (ADR 0005/0006). */
export function assertClientWritable(clientStatus: EventClient["status"]): void {
  if (clientStatus === "archived") {
    throw new ConflictError("This client is archived, so its events are read-only. Unarchive the client first.", ERROR_CODES.CLIENT_ARCHIVED);
  }
}

/** FR-EVT-02: only an existing, ACTIVE template with stages can start an event. */
export function assertTemplateUsable(template: EventTemplate | null): EventTemplate {
  if (!template || !template.active || template.stageNames.length === 0) {
    throw new BadRequestError("Pick an active stage template", ERROR_CODES.EVENT_TEMPLATE_INVALID);
  }
  return template;
}

export function assertEventVersion(current: number, expected: number | undefined): void {
  if (expected !== undefined && current !== expected) {
    throw new ConflictError("This event was changed by someone else. Reload and try again.", ERROR_CODES.EVENT_MODIFIED);
  }
}

/** Ends on or after it starts, and lasts at most MAX_ITEM_DAYS (the shared cap the calendar scans rely on). */
export function assertEventTimes(startsAt: string, endsAt: string): void {
  const problem = spanProblem(startsAt, endsAt);
  if (problem) throw new BadRequestError(problem, ERROR_CODES.EVENT_TIMES_INVALID);
}

/** Every assigned team member must be an active staff account. `found` = the ids the database confirmed. */
export function assertTeamValid(requested: readonly string[], found: ReadonlySet<string>): void {
  const missing = requested.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new BadRequestError("Every team member must be an active staff account", ERROR_CODES.EVENT_TEAM_INVALID);
  }
}

/**
 * Stage moves (FR-EVT-06). The current stage can be set to ANY stage of the
 * event, forward or back: work really does go back (client review -> editing),
 * and a wrong click must be undoable; the history keeps every move. Refused:
 *  - a cancelled or postponed event (409 EVENT_NOT_ACTIVE) -- reactivate it first;
 *  - a stage of another event (400 EVENT_STAGE_INVALID);
 *  - the stage it's already at (409 EVENT_STAGE_UNCHANGED).
 */
export function assertStageMove(input: { state: EventState; currentStageId: string; stages: readonly EventStage[]; targetStageId: string }): EventStage {
  if (input.state !== "active") {
    throw new ConflictError("Only an active event can move between stages. Set it back to active first.", ERROR_CODES.EVENT_NOT_ACTIVE);
  }
  const target = input.stages.find((s) => s.id === input.targetStageId);
  if (!target) throw new BadRequestError("That stage doesn't belong to this event", ERROR_CODES.EVENT_STAGE_INVALID);
  if (target.id === input.currentStageId) {
    throw new ConflictError("The event is already at this stage", ERROR_CODES.EVENT_STAGE_UNCHANGED);
  }
  return target;
}

/**
 * A calendar range: both ends or neither; `to` after `from`; at most 92 days.
 * Returns the instants, or undefined when no range was asked for.
 */
export function resolveRange(from: string | undefined, to: string | undefined): { from: string; to: string } | undefined {
  if (from === undefined && to === undefined) return undefined;
  if (from === undefined || to === undefined) {
    throw new BadRequestError("Send both `from` and `to`, or neither", ERROR_CODES.EVENT_RANGE_INVALID);
  }
  const problem = rangeProblem(from, to);
  if (problem) throw new BadRequestError(problem, ERROR_CODES.EVENT_RANGE_INVALID);
  return { from, to };
}
