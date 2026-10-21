import { and, asc, desc, eq, gte, ilike, lt, ne, sql, type SQL } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { containsPattern } from "../../../common/database/like-pattern";
import { AppError, InternalError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
// Cross-module Infrastructure-only reads (ADR 0003): the client a to-do
// belongs to, its optional event, and staff names.
import { clients } from "../../clients/infrastructure/clients.schema";
import { events } from "../../events/infrastructure/events.schema";
import { profiles } from "../../users/infrastructure/profile.schema";
import { clientTodos } from "./client-todos.schema";
import type { ClientTodoEntity } from "../domain/client-todo.entity";
import type { TodoClient, TodoEvent } from "../domain/client-todo.rules";
import type {
  ClientTodoChangeDecision,
  ClientTodoListFilters,
  ClientTodoPage,
  ClientTodosRepositoryPort,
  NewClientTodoRecord,
} from "../application/ports/client-todos-repository.port";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A to-do + its client, event title and creator's name: one query, three joins (never a per-row lookup). */
const TODO_SELECT = {
  id: clientTodos.id,
  clientId: clientTodos.clientId,
  ownerId: clients.ownerId,
  clientStatus: clients.status,
  eventId: clientTodos.eventId,
  eventTitle: events.title,
  title: clientTodos.title,
  description: clientTodos.description,
  dueAt: clientTodos.dueAt,
  priority: clientTodos.priority,
  status: clientTodos.status,
  completedAt: clientTodos.completedAt,
  createdBy: clientTodos.createdBy,
  createdByName: profiles.fullName,
  version: clientTodos.version,
  createdAt: clientTodos.createdAt,
  updatedAt: clientTodos.updatedAt,
};

type TodoRow = Omit<ClientTodoEntity, "dueAt" | "completedAt" | "createdAt" | "updatedAt"> & {
  dueAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function toEntity(row: TodoRow): ClientTodoEntity {
  return {
    ...row,
    dueAt: iso(row.dueAt),
    completedAt: iso(row.completedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Rethrows a deliberate AppError (a guard's 404/409) untouched; wraps anything else as a 500 with the cause for the logs. */
async function guarded<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new InternalError(`Failed to ${what}`, error);
  }
}

function baseSelect(ex: Executor) {
  return ex
    .select(TODO_SELECT)
    .from(clientTodos)
    .innerJoin(clients, eq(clients.id, clientTodos.clientId))
    .leftJoin(events, eq(events.id, clientTodos.eventId))
    .leftJoin(profiles, eq(profiles.id, clientTodos.createdBy));
}

async function selectTodo(ex: Executor, id: string, forUpdate = false): Promise<ClientTodoEntity | null> {
  const query = baseSelect(ex).where(eq(clientTodos.id, id)).limit(1);
  // FOR UPDATE OF client_todos: lock only the to-do row (not the client, event or profile).
  const rows: TodoRow[] = forUpdate ? await query.for("update", { of: clientTodos }) : await query;
  return rows[0] ? toEntity(rows[0]) : null;
}

/**
 * Client to-dos through Drizzle. A list is one page query + one count (never
 * per row), served by the partial indexes in the migration: the default
 * (open) list walks client_todos_client_open_due_idx; done / all lists use
 * client_todos_client_created_idx. A client has tens of to-dos, not thousands.
 */
export class DrizzleClientTodosRepository implements ClientTodosRepositoryPort {
  /** Shared by findMany and countMany so the page and its total can never disagree. */
  private conditions(f: ClientTodoListFilters): SQL | undefined {
    const c: SQL[] = [eq(clientTodos.clientId, f.clientId)];
    if (f.status) c.push(eq(clientTodos.status, f.status));
    else if (f.openOnly) c.push(ne(clientTodos.status, "done"));
    if (f.priority) c.push(eq(clientTodos.priority, f.priority));
    if (f.overdue) c.push(ne(clientTodos.status, "done"), lt(clientTodos.dueAt, new Date(f.now)));
    if (f.dueFrom) c.push(gte(clientTodos.dueAt, f.dueFrom));
    if (f.dueTo) c.push(lt(clientTodos.dueAt, f.dueTo));
    if (f.search) c.push(ilike(clientTodos.title, containsPattern(f.search)));
    return and(...c);
  }

  findMany(filters: ClientTodoListFilters, page: ClientTodoPage) {
    return guarded("load to-dos", async () => {
      // Done list: most recently completed first. Otherwise open before done,
      // then soonest due (no due date last), then newest; id breaks ties.
      const order =
        filters.status === "done"
          ? [desc(clientTodos.completedAt), desc(clientTodos.id)]
          : [
              asc(sql`(${clientTodos.status} = 'done')`),
              sql`${clientTodos.dueAt} asc nulls last`,
              desc(clientTodos.createdAt),
              desc(clientTodos.id),
            ];
      const rows: TodoRow[] = await baseSelect(db)
        .where(this.conditions(filters))
        .orderBy(...order)
        .limit(page.limit)
        .offset(page.offset);
      return rows.map(toEntity);
    });
  }

  countMany(filters: ClientTodoListFilters) {
    return guarded("count to-dos", async () => {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(clientTodos)
        .where(this.conditions(filters));
      return row?.count ?? 0;
    });
  }

  findById(id: string) {
    return guarded("load the to-do", () => selectTodo(db, id));
  }

  findClient(id: string) {
    return guarded("load the client", async (): Promise<TodoClient | null> => {
      const [row] = await db.select({ id: clients.id, ownerId: clients.ownerId, status: clients.status }).from(clients).where(eq(clients.id, id)).limit(1);
      return row ?? null;
    });
  }

  findEvent(id: string) {
    return guarded("load the event", async (): Promise<TodoEvent | null> => {
      const [row] = await db.select({ id: events.id, clientId: events.clientId }).from(events).where(eq(events.id, id)).limit(1);
      return row ?? null;
    });
  }

  create(record: NewClientTodoRecord, guard: (client: TodoClient) => void) {
    return guarded("create the to-do", () =>
      db.transaction(async (tx) => {
        const [client] = await tx
          .select({ id: clients.id, ownerId: clients.ownerId, status: clients.status })
          .from(clients)
          .where(eq(clients.id, record.clientId))
          .for("share");
        if (!client) throw new NotFoundError("Client not found", ERROR_CODES.CLIENT_NOT_FOUND);
        guard(client);

        const [row] = await tx
          .insert(clientTodos)
          .values({
            clientId: record.clientId,
            eventId: record.eventId,
            title: record.title,
            description: record.description,
            dueAt: record.dueAt ? new Date(record.dueAt) : null,
            priority: record.priority,
            createdBy: record.createdBy,
          })
          .returning({ id: clientTodos.id });
        return row!.id;
      }),
    );
  }

  update(id: string, decide: ClientTodoChangeDecision) {
    return guarded("update the to-do", async () => {
      const deleted = await db.transaction(async (tx) => {
        const current = await selectTodo(tx, id, true);
        if (!current) throw new NotFoundError("To-do not found", ERROR_CODES.CLIENT_TODO_NOT_FOUND);
        const changes = decide(current);

        if (changes.deleted) {
          await tx.delete(clientTodos).where(eq(clientTodos.id, id));
          return current;
        }
        const { dueAt, ...rest } = changes.fields ?? {};
        const set: Partial<typeof clientTodos.$inferInsert> = { ...rest };
        if (dueAt !== undefined) set.dueAt = dueAt ? new Date(dueAt) : null;
        if (changes.completion === "stamp") set.completedAt = sql`now()` as unknown as Date;
        if (changes.completion === "clear") set.completedAt = null;
        await tx
          .update(clientTodos)
          .set({ ...set, version: sql`${clientTodos.version} + 1` })
          .where(eq(clientTodos.id, id));
        return null;
      });
      // A delete returns the row as it was; an edit re-reads it.
      return deleted ?? (await selectTodo(db, id))!;
    });
  }
}
