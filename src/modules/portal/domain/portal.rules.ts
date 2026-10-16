import { BadRequestError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { rangeProblem } from "../../../domain";
import type { PortalEvent } from "./portal.entity";

/** portal:manage -- the Admin manages every client's link, a manager only their own clients'. */
export type PortalScope = { kind: "all" } | { kind: "own"; userId: string };

export interface PortalClient {
  id: string;
  ownerId: string;
  status: "active" | "paused" | "archived";
}

/** The client whose link is managed: visible (else 404 CLIENT_NOT_FOUND, no existence leak). */
export function assertClientManageable(scope: PortalScope, client: PortalClient | null): PortalClient {
  if (!client || (scope.kind === "own" && client.ownerId !== scope.userId)) {
    throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
  }
  return client;
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
