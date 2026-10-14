import { BadRequestError, ForbiddenError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { isClientManager, type Role } from "../../../domain";

/**
 * Who owns a client and who can see it (REQUIREMENTS §4 "data isolation",
 * FR-CLI-01/03/04/05). A client has exactly one owner, a client manager:
 * admin, social_media_manager or marketing_manager.
 */

/** Which clients a caller may see: every client (Admin), or only those they own (SMM / Marketing Manager). */
export type ClientScope = { kind: "all" } | { kind: "own"; userId: string };

/** A would-be owner as stored: enough to decide whether they may own clients. */
export interface OwnerCandidate {
  id: string;
  role: Role;
  active: boolean;
}

/**
 * The client, if the caller may see it. Someone else's client is a 404, never
 * a 403, so a manager can't even learn that an id exists (needleye's leads
 * pattern). `client` is null when no such row exists.
 */
export function assertVisible<T extends { ownerId: string }>(scope: ClientScope, client: T | null): T {
  if (!client || (scope.kind === "own" && client.ownerId !== scope.userId)) {
    throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
  }
  return client;
}

/**
 * The owner a new client gets. By default the creator (FR-CLI-01). Only a
 * caller who sees all clients (the Admin) may name someone else; a manager
 * naming another owner is refused rather than silently ignored, so the form
 * never files a client somewhere the user didn't expect.
 */
export function resolveNewOwner(scope: ClientScope, callerId: string, requestedOwnerId: string | undefined): string {
  if (requestedOwnerId === undefined || requestedOwnerId === callerId) return callerId;
  if (scope.kind !== "all") {
    throw new ForbiddenError("Only the Admin can create a client for someone else", ERROR_CODES.CLIENT_OWNER_FORBIDDEN);
  }
  return requestedOwnerId;
}

/** The new owner (on create-for-someone or reassign) must be an active client manager. */
export function assertValidOwner(candidate: OwnerCandidate | null): OwnerCandidate {
  if (!candidate || !candidate.active || !isClientManager(candidate.role)) {
    throw new BadRequestError(
      "A client can only be owned by an active Admin, Social Media Manager or Marketing Manager",
      ERROR_CODES.CLIENT_OWNER_INVALID,
    );
  }
  return candidate;
}
