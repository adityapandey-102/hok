import { BadRequestError, ForbiddenError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { isClientManager, type Role } from "../../../domain";
import { CLIENT_TEAM_MAX } from "./client.entity";

/**
 * Who works on a client and who can see it (REQUIREMENTS §4 "data isolation",
 * FR-CLI-01/03/04/05; client teams decided 2026-10-23). HOK owns every
 * client; each has an assigned TEAM of client managers (admin, social media /
 * marketing / project manager), one of them the LEAD (`owner_id`).
 * The Admin sees every client; a manager sees only clients they're on.
 */

/** Which clients a caller may see: every client (Admin), or only those whose team they're on. */
export type ClientScope = { kind: "all" } | { kind: "own"; userId: string };

/** A would-be team member as stored: enough to decide whether they may work on clients. */
export interface OwnerCandidate {
  id: string;
  role: Role;
  active: boolean;
}

/**
 * The client, if the caller may see it. A client whose team the caller isn't
 * on is a 404, never a 403, so a manager can't even learn that an id exists
 * (needleye's leads pattern). `client` is null when no such row exists.
 */
export function assertVisible<T extends { team: readonly { id: string }[] }>(scope: ClientScope, client: T | null): T {
  if (!client || (scope.kind === "own" && !client.team.some((m) => m.id === scope.userId))) {
    throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
  }
  return client;
}

/** Archiving, unarchiving and changing a team are the Admin's (a manager sees the client but gets a 403). */
export function assertAdmin(scope: ClientScope, action: string): void {
  if (scope.kind !== "all") throw new ForbiddenError(`Only the Admin can ${action}`, ERROR_CODES.CLIENT_ADMIN_ONLY);
}

/**
 * The lead a new client gets. By default the creator (FR-CLI-01), who is also
 * its first team member. Only the Admin may name someone else; a manager
 * naming another lead is refused rather than silently ignored.
 */
export function resolveNewOwner(scope: ClientScope, callerId: string, requestedOwnerId: string | undefined): string {
  if (requestedOwnerId === undefined || requestedOwnerId === callerId) return callerId;
  if (scope.kind !== "all") {
    throw new ForbiddenError("Only the Admin can create a client for someone else", ERROR_CODES.CLIENT_OWNER_FORBIDDEN);
  }
  return requestedOwnerId;
}

/** A lead or team member must be an active client manager. */
export function assertValidOwner(candidate: OwnerCandidate | null): OwnerCandidate {
  if (!candidate || !candidate.active || !isClientManager(candidate.role)) {
    throw new BadRequestError(
      "Only an active Admin, Social Media, Marketing or Project Manager can be on a client's team",
      ERROR_CODES.CLIENT_OWNER_INVALID,
    );
  }
  return candidate;
}

/** The team as asked: duplicates dropped, the lead always on it, capped. */
export function normalizeTeam(leadId: string, memberIds: readonly string[]): string[] {
  const team = [...new Set([leadId, ...memberIds])];
  if (team.length > CLIENT_TEAM_MAX) {
    throw new BadRequestError(`A client's team can have at most ${CLIENT_TEAM_MAX} people`, ERROR_CODES.CLIENT_OWNER_INVALID);
  }
  return team;
}

/** Every id must be an active client manager the database knows. */
export function assertValidTeam(ids: readonly string[], found: readonly OwnerCandidate[]): void {
  for (const id of ids) assertValidOwner(found.find((c) => c.id === id) ?? null);
}

/** Who a team change adds and removes (the added ones are told). */
export function teamDiff(before: readonly string[], after: readonly string[]): { added: string[]; removed: string[] } {
  return { added: after.filter((id) => !before.includes(id)), removed: before.filter((id) => !after.includes(id)) };
}
