import { and, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "./drizzle-client";
import { InternalError } from "../errors/app-error";
// Cross-module Infrastructure-only reads (ADR 0003): the Portal module's
// `portal_links`, the Clients module's `clients`, the Users module's `profiles`.
// Lives in common/ (like profiles.ts) because the public portal middleware,
// which several modules' public routes depend on, needs it.
import { portalLinks } from "../../modules/portal/infrastructure/portal.schema";
import { clients } from "../../modules/clients/infrastructure/clients.schema";
import { notifiedTeamIdsOf } from "../../modules/clients/infrastructure/client-team.sql";
import { profiles } from "../../modules/users/infrastructure/profile.schema";

/** What a valid portal link opens: one client, and the first name of their manager -- nothing else about staff. */
export interface PortalContext {
  linkId: string;
  clientId: string;
  businessName: string;
  logoUrl: string | null;
  timeZone: string;
  /** The lead. For server-side use only; never sent to the portal. */
  ownerId: string;
  /** The team members a new comment notifies (active client managers only). Server-side only; never sent to the portal. */
  teamIds: string[];
  ownerFirstName: string;
}

/**
 * The active link with this token hash, if its client isn't archived. One
 * indexed lookup (token_hash is unique). Missing, revoked and archived all
 * come back as null, so the caller answers them identically.
 */
export async function findActivePortalLink(tokenHash: string): Promise<PortalContext | null> {
  let row;
  try {
    [row] = await db
      .select({
        linkId: portalLinks.id,
        clientId: clients.id,
        businessName: clients.businessName,
        logoUrl: clients.logoUrl,
        timeZone: clients.timeZone,
        ownerId: clients.ownerId,
        teamIds: notifiedTeamIdsOf(clients.id),
        ownerName: profiles.fullName,
      })
      .from(portalLinks)
      .innerJoin(clients, eq(clients.id, portalLinks.clientId))
      .innerJoin(profiles, eq(profiles.id, clients.ownerId))
      .where(and(eq(portalLinks.tokenHash, tokenHash), eq(portalLinks.active, true), ne(clients.status, "archived")))
      .limit(1);
  } catch (error) {
    throw new InternalError("Failed to open the portal", error);
  }
  if (!row) return null;
  const { ownerName, ...rest } = row;
  return { ...rest, ownerFirstName: ownerName.trim().split(/\s+/)[0] ?? "" };
}

/** "Last opened", written at most once an hour per link so portal traffic doesn't turn into writes. Best-effort. */
export async function touchPortalLink(linkId: string): Promise<void> {
  await db
    .update(portalLinks)
    .set({ lastUsedAt: sql`now()` })
    .where(and(eq(portalLinks.id, linkId), or(isNull(portalLinks.lastUsedAt), lt(portalLinks.lastUsedAt, sql`now() - interval '1 hour'`))));
}
