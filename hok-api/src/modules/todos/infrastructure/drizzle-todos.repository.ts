import { and, asc, desc, eq, gte, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { guarded } from "../../../common/database/guarded";
import { NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { todos } from "./todos.schema";
import type { TodoEntity } from "../domain/todo.entity";
import type { NewTodoRecord, TodoChanges, TodoFilters, TodosRepositoryPort } from "../application/ports/todos-repository.port";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function toEntity(r: typeof todos.$inferSelect): TodoEntity {
  return {
    id: r.id,
    title: r.title,
    notes: r.notes,
    dueAt: iso(r.dueAt),
    urgency: r.urgency,
    doneAt: iso(r.doneAt),
    nextRemindAt: iso(r.nextRemindAt),
    version: r.version,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const notFound = () => new NotFoundError("To-do not found", ERROR_CODES.TODO_NOT_FOUND);

/** The owner's row, optionally locked. `owner_id` is in the WHERE, so someone else's id is "not found". */
async function selectOwned(ex: Executor, ownerId: string, id: string, forUpdate = false) {
  const q = ex.select().from(todos).where(and(eq(todos.id, id), eq(todos.ownerId, ownerId))).limit(1);
  const [row] = forUpdate ? await q.for("update") : await q;
  return row ?? null;
}

/**
 * To-dos through Drizzle. A list is one page query + one count, both pinned to
 * the owner and served by the owner's partial indexes (todos_owner_open_due_idx,
 * todos_owner_created_idx, todos_owner_due_idx). Volume: a few dozen rows per
 * person, so the live (open) set is tiny.
 */
export class DrizzleTodosRepository implements TodosRepositoryPort {
  /** Shared by findMany and countMany so the page and its total can never disagree. */
  private conditions(f: TodoFilters): SQL {
    const c: SQL[] = [eq(todos.ownerId, f.ownerId)];
    if (f.status === "open") c.push(isNull(todos.doneAt));
    else if (f.status === "done") c.push(isNotNull(todos.doneAt));
    if (f.dueFrom) c.push(gte(todos.dueAt, new Date(f.dueFrom)));
    if (f.dueTo) c.push(lt(todos.dueAt, new Date(f.dueTo)));
    return and(...c)!;
  }

  findMany(filters: TodoFilters, page: { limit: number; offset: number }) {
    return guarded("load to-dos", async () => {
      // Open: soonest due first (no due date last), then newest. Done: most recently done first.
      // All: open ones first (in the open order), then done ones (most recently done first).
      const order =
        filters.status === "done"
          ? [desc(todos.doneAt), desc(todos.id)]
          : filters.status === "open"
            ? [sql`${todos.dueAt} asc nulls last`, desc(todos.createdAt), desc(todos.id)]
            : [
                asc(sql`(${todos.doneAt} is not null)`),
                sql`case when ${todos.doneAt} is null then ${todos.dueAt} end asc nulls last`,
                sql`${todos.doneAt} desc nulls last`,
                desc(todos.createdAt),
                desc(todos.id),
              ];
      const rows = await db.select().from(todos).where(this.conditions(filters)).orderBy(...order).limit(page.limit).offset(page.offset);
      return rows.map(toEntity);
    });
  }

  countMany(filters: TodoFilters) {
    return guarded("count to-dos", async () => {
      const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(todos).where(this.conditions(filters));
      return row?.count ?? 0;
    });
  }

  create(record: NewTodoRecord) {
    return guarded("create the to-do", async () => {
      const [row] = await db
        .insert(todos)
        .values({
          ownerId: record.ownerId,
          title: record.title,
          notes: record.notes,
          dueAt: record.dueAt ? new Date(record.dueAt) : null,
          urgency: record.urgency,
          nextRemindAt: record.nextRemindAt ? new Date(record.nextRemindAt) : null,
        })
        .returning();
      return toEntity(row!);
    });
  }

  update(ownerId: string, id: string, decide: (current: TodoEntity) => TodoChanges) {
    return guarded("update the to-do", () =>
      db.transaction(async (tx) => {
        const current = await selectOwned(tx, ownerId, id, true);
        if (!current) throw notFound();
        const { dueAt, doneAt, nextRemindAt, ...rest } = decide(toEntity(current));
        const set: Partial<typeof todos.$inferInsert> = { ...rest };
        if (dueAt !== undefined) set.dueAt = dueAt ? new Date(dueAt) : null;
        if (doneAt !== undefined) set.doneAt = doneAt ? new Date(doneAt) : null;
        if (nextRemindAt !== undefined) set.nextRemindAt = nextRemindAt ? new Date(nextRemindAt) : null;
        if (Object.keys(set).length === 0) return toEntity(current); // nothing to write

        const [row] = await tx
          .update(todos)
          .set({ ...set, version: sql`${todos.version} + 1` })
          .where(and(eq(todos.id, id), eq(todos.ownerId, ownerId)))
          .returning();
        return toEntity(row!);
      }),
    );
  }

  delete(ownerId: string, id: string) {
    return guarded("delete the to-do", async () => {
      const rows = await db.delete(todos).where(and(eq(todos.id, id), eq(todos.ownerId, ownerId))).returning({ id: todos.id });
      if (rows.length === 0) throw notFound();
    });
  }
}
