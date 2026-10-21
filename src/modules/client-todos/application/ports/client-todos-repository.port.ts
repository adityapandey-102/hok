import type { ClientTodoEntity, ClientTodoFields } from "../../domain/client-todo.entity";
import type { TodoClient, TodoEvent } from "../../domain/client-todo.rules";

/** Server-side list filters for one client. `dueFrom` inclusive, `dueTo` exclusive. */
export interface ClientTodoListFilters {
  clientId: string;
  /** An exact status; without it `openOnly` decides. */
  status?: ClientTodoEntity["status"];
  openOnly: boolean;
  priority?: ClientTodoEntity["priority"];
  overdue: boolean;
  /** "Now" for the overdue filter, an ISO instant (the service's clock). */
  now: string;
  dueFrom?: Date;
  dueTo?: Date;
  search?: string;
}

export interface ClientTodoPage {
  limit: number;
  offset: number;
}

export interface NewClientTodoRecord {
  clientId: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  priority: ClientTodoEntity["priority"];
  eventId: string | null;
  createdBy: string;
}

/** What one guarded write changes. `deleted: true` is the hard delete. */
export interface ClientTodoChanges {
  fields?: Partial<ClientTodoFields>;
  /** "stamp" sets completed_at to now, "clear" nulls it. */
  completion?: "stamp" | "clear";
  deleted?: true;
}

/** Guard callback (needleye's pattern): given the row after the lock, throw or return the changes. */
export type ClientTodoChangeDecision = (current: ClientTodoEntity) => ClientTodoChanges;

/** Persistence contract for the Client to-dos module -- data access only, no business rules. */
export interface ClientTodosRepositoryPort {
  findMany(filters: ClientTodoListFilters, page: ClientTodoPage): Promise<ClientTodoEntity[]>;
  countMany(filters: ClientTodoListFilters): Promise<number>;
  findById(id: string): Promise<ClientTodoEntity | null>;
  findClient(id: string): Promise<TodoClient | null>;
  findEvent(id: string): Promise<TodoEvent | null>;
  /**
   * Inserts the to-do. `guard` runs on the locked (FOR SHARE) client row
   * first, so a client archived or reassigned since the service's read is
   * refused. Returns the new id.
   */
  create(record: NewClientTodoRecord, guard: (client: TodoClient) => void): Promise<string>;
  /**
   * In one transaction: lock the row, call `decide`, apply the changes and
   * bump `version`. Returns the to-do as stored afterwards (for a delete: as
   * it was). Throws 404 CLIENT_TODO_NOT_FOUND if there is no row.
   */
  update(id: string, decide: ClientTodoChangeDecision): Promise<ClientTodoEntity>;
}
