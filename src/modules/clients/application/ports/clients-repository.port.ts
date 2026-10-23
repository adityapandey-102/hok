import type { ClientEntity, ClientProfileFields, ClientStatus, ClientSummaryEntity } from "../../domain/client.entity";
import type { OwnerCandidate } from "../../domain/client-ownership.rules";

/**
 * Server-side list filters. `ownerId` means "clients whose team includes this
 * person", already resolved by the service from the caller's scope (a
 * manager's own id, or the Admin's optional filter). No `status` means
 * "active and paused" -- archived clients are hidden.
 */
export interface ClientListFilters {
  ownerId?: string;
  search?: string;
  status?: ClientStatus;
  industry?: string;
}

/** Bounded page window (offset pagination; limit already clamped by the route). */
export interface ClientListPage {
  limit: number;
  offset: number;
}

/** `ownerId` is the lead; the repository also makes them the first team member (`addedBy` = the creator). */
export interface NewClientRecord extends ClientProfileFields {
  ownerId: string;
  addedBy: string;
}

/**
 * What one guarded write changes. `archivedAt: "now"` stamps the database's
 * clock; `null` clears it. An empty object writes nothing (and doesn't bump
 * the version) -- e.g. reassigning a client to the owner it already has.
 */
export interface ClientChanges {
  fields?: Partial<ClientProfileFields>;
  status?: ClientStatus;
  archivedAt?: "now" | null;
  /** Replace the team: `memberIds` (lead included) becomes the whole team, `leadId` its lead. */
  team?: { leadId: string; memberIds: string[]; addedBy: string };
  /**
   * Tell the people just added (M9, FR-NTF-03 "client assigned to me"): the
   * repository writes their bell entries in the same transaction as the
   * change, so the two commit together (ARCHITECTURE §8).
   */
  addedNotice?: ClientReassignedNotice;
}

/** The facts of a team change, for the notification of the people added. */
export interface ClientReassignedNotice {
  clientId: string;
  clientName: string;
  recipientIds: string[];
  actorId: string;
}

/**
 * Guard callback (needleye's pattern): given the row as it stands **after**
 * the lock, either throw (not visible, stale version, wrong state) or return
 * the changes to apply. Rules that must hold under concurrency go here, never
 * in a read made before the lock.
 */
export type ClientChangeDecision = (current: ClientEntity) => ClientChanges;

/** Persistence contract for the Clients module -- data access only, no business rules. */
export interface ClientsRepositoryPort {
  findMany(filters: ClientListFilters, page: ClientListPage): Promise<ClientSummaryEntity[]>;
  countMany(filters: ClientListFilters): Promise<number>;
  findById(id: string): Promise<ClientEntity | null>;
  create(record: NewClientRecord): Promise<ClientEntity>;
  /**
   * In one transaction: lock the client row (`FOR UPDATE`), call `decide` with
   * it, apply the returned changes and bump `version`. Returns the client as
   * stored afterwards. Throws 404 CLIENT_NOT_FOUND if there's no such row.
   */
  update(id: string, decide: ClientChangeDecision): Promise<ClientEntity>;
  /** The profiles that would lead or join a client (one query), for the team rules. Unknown ids are simply absent. */
  findTeamCandidates(userIds: readonly string[]): Promise<OwnerCandidate[]>;
}
