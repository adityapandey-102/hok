import { BadRequestError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import type { ClientTodoEntity, ClientTodoStatus } from "./client-todo.entity";

/**
 * Client to-do rules (FR-CTSK-01..04). Pure functions that throw AppError
 * (ADR 0002). A to-do inherits its client's row scope: a manager sees only
 * to-dos of clients they own; anything else is a 404.
 */

/** Same shape as the Clients module's scope (kept local: domains don't import each other, ADR 0003). */
export type ClientTodoScope = { kind: "all" } | { kind: "own"; userId: string };

/** The client a to-do belongs to, as stored. */
export interface TodoClient {
  id: string;
  /** The client's team: who may see this (internal, never sent to the browser). */
  teamIds: string[];
  status: "active" | "paused" | "archived";
}

/** The event a to-do may be linked to. */
export interface TodoEvent {
  id: string;
  clientId: string;
}

export function assertTodoVisible(scope: ClientTodoScope, todo: Pick<ClientTodoEntity, "teamIds"> | null): void {
  if (!todo || (scope.kind === "own" && !todo.teamIds.includes(scope.userId))) {
    throw new NotFoundError("To-do not found", ERROR_CODES.CLIENT_TODO_NOT_FOUND);
  }
}

/** The client a list/create goes under: must exist and be visible (else 404 CLIENT_NOT_FOUND). */
export function assertClientVisible(scope: ClientTodoScope, client: TodoClient | null): TodoClient {
  if (!client || (scope.kind === "own" && !client.teamIds.includes(scope.userId))) {
    throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
  }
  return client;
}

/** The client for a new to-do: visible and not archived (409 CLIENT_ARCHIVED). */
export function assertClientUsable(scope: ClientTodoScope, client: TodoClient | null): TodoClient {
  const visible = assertClientVisible(scope, client);
  assertClientWritable(visible.status);
  return visible;
}

/** An archived client's to-dos are read-only until the client is unarchived. */
export function assertClientWritable(clientStatus: TodoClient["status"]): void {
  if (clientStatus === "archived") {
    throw new ConflictError("This client is archived, so its to-dos are read-only. Unarchive the client first.", ERROR_CODES.CLIENT_ARCHIVED);
  }
}

/** Optimistic lock: `undefined` = the caller didn't send a version (allowed only where documented, e.g. delete). */
export function assertTodoVersion(current: number, expected: number | undefined): void {
  if (expected !== undefined && current !== expected) {
    throw new ConflictError("This to-do was changed by someone else. Reload and try again.", ERROR_CODES.CLIENT_TODO_MODIFIED);
  }
}

/** A linked event must exist and belong to the to-do's own client. */
export function assertEventLinkable(clientId: string, event: TodoEvent | null): void {
  if (!event || event.clientId !== clientId) {
    throw new BadRequestError("Pick one of this client's events", ERROR_CODES.CLIENT_TODO_EVENT_INVALID);
  }
}

/** `dueFrom` must be before `dueTo`. */
export function assertDueRange(from: Date | undefined, to: Date | undefined): void {
  if (from && to && from.getTime() >= to.getTime()) {
    throw new BadRequestError("`dueFrom` must be before `dueTo`", ERROR_CODES.CLIENT_TODO_RANGE_INVALID);
  }
}

/**
 * What a status change does to `completed_at` (the DB CHECK requires
 * done <=> completed_at set): stamp it when a to-do becomes done, clear it
 * when it is reopened, otherwise leave it alone.
 */
export function completionChange(from: ClientTodoStatus, to: ClientTodoStatus): "stamp" | "clear" | "keep" {
  if (to === "done" && from !== "done") return "stamp";
  if (to !== "done" && from === "done") return "clear";
  return "keep";
}
