import type { PersonalEventEntity } from "../../domain/personal-event.entity";

export interface PersonalEventFilters {
  /** Resolved from scope by the service: a manager's own id, or the Admin's optional filter. */
  ownerId?: string;
  clientId?: string;
  /** Overlap with [from, to). */
  range?: { from: string; to: string };
}

export interface NewPersonalEvent {
  ownerId: string;
  clientId: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  description: string | null;
}

export type PersonalEventChanges = Partial<Omit<NewPersonalEvent, "ownerId">>;

/** Persistence for personal events -- data access only. */
export interface PersonalEventsRepositoryPort {
  findMany(filters: PersonalEventFilters, page: { limit: number; offset: number }): Promise<PersonalEventEntity[]>;
  countMany(filters: PersonalEventFilters): Promise<number>;
  findById(id: string): Promise<PersonalEventEntity | null>;
  /** The team of the client an entry would be linked to (the entry owner must be on it). */
  findClientTeam(clientId: string): Promise<{ teamIds: string[] } | null>;
  create(record: NewPersonalEvent): Promise<string>;
  /** Locks the row, lets `decide` check it and return the changes, applies them and bumps the version. 404 if missing. */
  update(id: string, decide: (current: PersonalEventEntity) => PersonalEventChanges): Promise<void>;
  /** Locks the row, lets `guard` check it, deletes it. 404 if missing. */
  delete(id: string, guard: (current: PersonalEventEntity) => void): Promise<void>;
}
