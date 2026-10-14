import type { ClientEntity, ClientProfileFields, ClientStatus, ClientSummaryEntity } from "../../domain/client.entity";
import type { OwnerCandidate } from "../../domain/client-ownership.rules";

/**
 * Server-side list filters. `ownerId` is already resolved by the service from
 * the caller's scope (a manager's own id, or the Admin's optional filter).
 * No `status` means "active and paused" -- archived clients are hidden.
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

export interface NewClientRecord extends ClientProfileFields {
  ownerId: string;
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
  ownerId?: string;
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
  /** The profile a client would be given to (create-for-someone, reassign), or null if no such user. */
  findOwnerCandidate(userId: string): Promise<OwnerCandidate | null>;
}
