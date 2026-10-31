import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { rangeProblem } from "../../../domain";
import type { PortalEvent } from "./portal.entity";

/**
 * portal:manage -- the Admin manages every client's link. A manager on the
 * client's team sees the link's status; only the client's LEAD makes or turns
 * off the link (client teams, 2026-10-23).
 */
export type PortalScope = { kind: "all" } | { kind: "own"; userId: string };

export interface PortalClient {
  id: string;
  /** The lead. */
  ownerId: string;
  /** The client's team. */
  teamIds: string[];
  status: "active" | "paused" | "archived";
}

/** The client whose link is looked at: on the caller's team (else 404 CLIENT_NOT_FOUND, no existence leak). */
export function assertClientManageable(scope: PortalScope, client: PortalClient | null): PortalClient {
  if (!client || (scope.kind === "own" && !client.teamIds.includes(scope.userId))) {
    throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
  }
  return client;
}

/** Making or turning off the link: the lead (or the Admin). Other team members see the client, so this is a 403. */
export function assertLead(scope: PortalScope, client: PortalClient): void {
  if (scope.kind === "own" && client.ownerId !== scope.userId) {
    throw new ForbiddenError("Only the client's lead can change its portal link. Ask them, or the Admin.", ERROR_CODES.PORTAL_LEAD_ONLY);
  }
}

/** No new link for an archived client (FR-CLI-07: archiving disables the portal). Unarchive first. */
export function assertCanIssueLink(client: PortalClient): void {
  if (client.status === "archived") {
    throw new ConflictError("This client is archived. Unarchive it before sharing a portal link.", ERROR_CODES.CLIENT_ARCHIVED);
  }
}

/** The portal's link to share: WEB_APP_URL + /p/<token> (hok-web's public portal route). */
export function portalUrl(webAppUrl: string, token: string): string {
  return `${webAppUrl.replace(/\/+$/, "")}/p/${token}`;
}

/** The portal calendar always needs a range: both ends, ≤ 92 days (FR-POR-05). */
export function assertPortalRange(from: string, to: string): void {
  const problem = rangeProblem(from, to);
  if (problem) throw new BadRequestError(problem, ERROR_CODES.CALENDAR_RANGE_INVALID);
}

/**
 * The dashboard's "current" event (FR-POR-04): the first upcoming one that is
 * still active (in progress now, or next). Cancelled and postponed events
 * stay visible in the lists but are never "current".
 */
export function pickCurrent(upcoming: readonly PortalEvent[]): PortalEvent | null {
  return upcoming.find((e) => e.state === "active") ?? null;
}
