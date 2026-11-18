import type { PortalAttention, PortalEvent, PortalEventDetail, PortalLinkRecord } from "../../domain/portal.entity";
import type { PortalClient } from "../../domain/portal.rules";

/** Staff side: one client's link. */
export interface PortalLinksRepositoryPort {
  findClient(clientId: string): Promise<PortalClient | null>;
  /** The active link, else the most recently revoked one, else null. */
  findCurrent(clientId: string): Promise<PortalLinkRecord | null>;
  /**
   * One transaction: lock the client row (FOR SHARE) and pass it to `guard`,
   * revoke any active link (clearing its stored token), insert the new one (by its hash, with its token). Returns the new link.
   */
  replace(clientId: string, token: string, tokenHash: string, createdBy: string, guard: (client: PortalClient) => void): Promise<PortalLinkRecord>;
  /** Revokes the active link if there is one; returns whether one was revoked. */
  revoke(clientId: string): Promise<boolean>;
}

/** Public side: client-safe reads for the client the link opens. Every query is pinned to that client id. */
export interface PortalReadRepositoryPort {
  /** Events ending at/after `now`, earliest first, at most `limit` (with their stages, approval flag and file counts, batched). */
  upcoming(clientId: string, now: Date, limit: number): Promise<PortalEvent[]>;
  /** Events that ended before `now`, latest first, at most `limit`. */
  recent(clientId: string, now: Date, limit: number): Promise<PortalEvent[]>;
  /** Events overlapping [from, to), earliest first, capped. */
  inRange(clientId: string, from: string, to: string, limit: number): Promise<PortalEvent[]>;
  /** One of THIS client's events with its client-visible updates, or null. */
  event(clientId: string, eventId: string): Promise<PortalEventDetail | null>;
  /** What needs the client now: all pending client approvals and the files shared since `since`. Two capped queries. */
  attention(clientId: string, since: Date): Promise<PortalAttention>;
}
