import { and, asc, desc, eq, gte, ilike, lt, ne, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../../common/database/drizzle-client";
import { containsPattern } from "../../../common/database/like-pattern";
import { AppError, InternalError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
// Cross-module Infrastructure-only reads (ADR 0003): the assignee's and
// author's names, the linked client's name and the linked event's title.
import { profiles } from "../../users/infrastructure/profile.schema";
import { clients } from "../../clients/infrastructure/clients.schema";
import { events } from "../../events/infrastructure/events.schema";
import { staffTaskUpdates, staffTasks } from "./staff-tasks.schema";
import type { StaffTaskDetail, StaffTaskEntity, StaffTaskSummaryEntity, StaffTaskUpdate } from "../domain/staff-task.entity";
import type { AssigneeCandidate, TaskClientRef, TaskEventRef } from "../domain/staff-task.rules";
import type {
  NewStaffTaskRecord,
  StaffTaskChangeDecision,
  StaffTaskListFilters,
  StaffTaskPage,
  StaffTasksRepositoryPort,
} from "../application/ports/staff-tasks-repository.port";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Timeline entries returned with a task, newest first. Older ones stay in the table. */
const UPDATES_LIMIT = 100;

const assignee = alias(profiles, "assignee");
const assigner = alias(profiles, "assigner");
const author = alias(profiles, "author");
const fromAssignee = alias(profiles, "from_assignee");
const toAssignee = alias(profiles, "to_assignee");

const TASK_SELECT = {
  id: staffTasks.id,
  title: staffTasks.title,
  description: staffTasks.description,
  assigneeId: staffTasks.assigneeId,
  assigneeName: assignee.fullName,
  assigneeRole: assignee.role,
  assignedBy: staffTasks.assignedBy,
  assignedByName: assigner.fullName,
  clientId: staffTasks.clientId,
  clientName: clients.businessName,
  eventId: staffTasks.eventId,
  dueAt: staffTasks.dueAt,
  priority: staffTasks.priority,
  status: staffTasks.status,
  rawFilesUrl: staffTasks.rawFilesUrl,
  referenceUrl: staffTasks.referenceUrl,
  script: staffTasks.script,
  referenceLinks: staffTasks.referenceLinks,
  completedAt: staffTasks.completedAt,
  version: staffTasks.version,
  createdAt: staffTasks.createdAt,
  updatedAt: staffTasks.updatedAt,
};

/** Exactly what a list row / board card shows. */
const SUMMARY_SELECT = {
  id: staffTasks.id,
  title: staffTasks.title,
  status: staffTasks.status,
  priority: staffTasks.priority,
  dueAt: staffTasks.dueAt,
  assigneeId: staffTasks.assigneeId,
  assigneeName: assignee.fullName,
  assigneeRole: assignee.role,
  clientId: staffTasks.clientId,
  clientName: clients.businessName,
  eventId: staffTasks.eventId,
  hasEditorBrief: sql<boolean>`(${staffTasks.rawFilesUrl} is not null)`,
  completedAt: staffTasks.completedAt,
  version: staffTasks.version,
  createdAt: staffTasks.createdAt,
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

async function guarded<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new InternalError(`Failed to ${what}`, error);
  }
}

/** SQLSTATE 42P01: the events table isn't there (migration 20261013000004 not applied). Drizzle may wrap it in `cause`. */
function isUndefinedTable(err: unknown): boolean {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  return e?.code === "42P01" || e?.cause?.code === "42P01";
}

function taskQuery(ex: Executor, id: string) {
  return ex
    .select(TASK_SELECT)
    .from(staffTasks)
    .innerJoin(assignee, eq(assignee.id, staffTasks.assigneeId))
    .leftJoin(assigner, eq(assigner.id, staffTasks.assignedBy))
    .leftJoin(clients, eq(clients.id, staffTasks.clientId))
    .where(eq(staffTasks.id, id))
    .limit(1);
}
type TaskRow = Awaited<ReturnType<typeof taskQuery>>[number];

function toEntity(row: TaskRow): StaffTaskEntity {
  return {
    ...row,
    referenceLinks: row.referenceLinks ?? [],
    dueAt: iso(row.dueAt),
    completedAt: iso(row.completedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function selectTask(ex: Executor, id: string, forUpdate = false): Promise<StaffTaskEntity | null> {
  // FOR UPDATE OF staff_tasks: lock the task, not the profiles or client it joins.
  const [row] = forUpdate ? await taskQuery(ex, id).for("update", { of: staffTasks }) : await taskQuery(ex, id);
  return row ? toEntity(row) : null;
}

/** An event's id, client and title -- or null when it's missing or the events table doesn't exist yet. */
async function selectEvent(eventId: string): Promise<TaskEventRef | null> {
  try {
    const [row] = await db
      .select({ id: events.id, clientId: events.clientId, title: events.title })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    return row ?? null;
  } catch (err) {
    if (isUndefinedTable(err)) return null;
    throw err;
  }
}

/**
 * Staff tasks through Drizzle. Every list is one page query (joined to the
 * assignee's profile and the client) + one count; a detail is the task + its
 * timeline (+ the event's title when linked), run in parallel. Volume: tens of
 * staff, a few thousand tasks a year; the live set (not done) stays small and
 * has its own partial indexes.
 */
export class DrizzleStaffTasksRepository implements StaffTasksRepositoryPort {
  /** Shared by findMany and countMany so the page and its total can never disagree. */
  private conditions(f: StaffTaskListFilters): SQL | undefined {
    const c: SQL[] = [];
    if (f.assigneeId) c.push(eq(staffTasks.assigneeId, f.assigneeId));
    if (f.role) c.push(eq(assignee.role, f.role));
    if (f.status) c.push(eq(staffTasks.status, f.status));
    else if (f.openOnly) c.push(ne(staffTasks.status, "done"));
    if (f.priority) c.push(eq(staffTasks.priority, f.priority));
    if (f.clientId) c.push(eq(staffTasks.clientId, f.clientId));
    if (f.overdue) c.push(ne(staffTasks.status, "done"), lt(staffTasks.dueAt, new Date(f.now)));
    if (f.dueFrom) c.push(gte(staffTasks.dueAt, new Date(f.dueFrom)));
    if (f.dueTo) c.push(lt(staffTasks.dueAt, new Date(f.dueTo)));
    if (f.search) c.push(ilike(staffTasks.title, containsPattern(f.search)));
    return c.length ? and(...c) : undefined;
  }

  findMany(filters: StaffTaskListFilters, page: StaffTaskPage) {
    return guarded("load tasks", async () => {
      // Done tasks: most recently completed first. Otherwise open before done,
      // then soonest due (no due date last), then newest; id breaks ties.
      const order =
        filters.status === "done"
          ? [desc(staffTasks.completedAt), desc(staffTasks.id)]
          : [
              asc(sql`(${staffTasks.status} = 'done')`),
              sql`${staffTasks.dueAt} asc nulls last`,
              desc(staffTasks.createdAt),
              desc(staffTasks.id),
            ];
      const rows = await db
        .select(SUMMARY_SELECT)
        .from(staffTasks)
        .innerJoin(assignee, eq(assignee.id, staffTasks.assigneeId))
        .leftJoin(clients, eq(clients.id, staffTasks.clientId))
        .where(this.conditions(filters))
        .orderBy(...order)
        .limit(page.limit)
        .offset(page.offset);
      return rows.map(
        (r): StaffTaskSummaryEntity => ({
          ...r,
          dueAt: iso(r.dueAt),
          completedAt: iso(r.completedAt),
          createdAt: r.createdAt.toISOString(),
        }),
      );
    });
  }

  countMany(filters: StaffTaskListFilters) {
    return guarded("count tasks", async () => {
      const query = db.select({ count: sql<number>`count(*)::int` }).from(staffTasks);
      // The role filter is the only one that needs the assignee's profile.
      const [row] = filters.role
        ? await query.innerJoin(assignee, eq(assignee.id, staffTasks.assigneeId)).where(this.conditions(filters))
        : await query.where(this.conditions(filters));
      return row?.count ?? 0;
    });
  }

  findById(id: string) {
    return guarded("load the task", () => selectTask(db, id));
  }

  findDetail(id: string) {
    return guarded("load the task", async (): Promise<StaffTaskDetail | null> => {
      const [task, updates] = await Promise.all([
        selectTask(db, id),
        db
          .select({
            id: staffTaskUpdates.id,
            kind: staffTaskUpdates.kind,
            authorId: staffTaskUpdates.authorId,
            authorName: author.fullName,
            fromStatus: staffTaskUpdates.fromStatus,
            toStatus: staffTaskUpdates.toStatus,
            fromAssigneeName: fromAssignee.fullName,
            toAssigneeName: toAssignee.fullName,
            comment: staffTaskUpdates.comment,
            createdAt: staffTaskUpdates.createdAt,
          })
          .from(staffTaskUpdates)
          .leftJoin(author, eq(author.id, staffTaskUpdates.authorId))
          .leftJoin(fromAssignee, eq(fromAssignee.id, staffTaskUpdates.fromAssigneeId))
          .leftJoin(toAssignee, eq(toAssignee.id, staffTaskUpdates.toAssigneeId))
          .where(eq(staffTaskUpdates.taskId, id))
          .orderBy(desc(staffTaskUpdates.createdAt), desc(staffTaskUpdates.id))
          .limit(UPDATES_LIMIT),
      ]);
      if (!task) return null;
      const event = task.eventId ? await selectEvent(task.eventId) : null;
      return {
        ...task,
        eventTitle: event?.title ?? null,
        updates: updates.map((u): StaffTaskUpdate => ({ ...u, createdAt: u.createdAt.toISOString() })),
      };
    });
  }

  findAssigneeCandidate(userId: string) {
    return guarded("load the assignee", async (): Promise<AssigneeCandidate | null> => {
      const [row] = await db
        .select({ id: profiles.id, role: profiles.role, active: profiles.active })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      return row ?? null;
    });
  }

  findClient(clientId: string) {
    return guarded("load the client", async (): Promise<TaskClientRef | null> => {
      const [row] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
      return row ?? null;
    });
  }

  findEvent(eventId: string) {
    return guarded("load the event", () => selectEvent(eventId));
  }

  create(record: NewStaffTaskRecord) {
    return guarded("create the task", () =>
      db.transaction(async (tx) => {
        const [row] = await tx
          .insert(staffTasks)
          .values({
            title: record.title,
            description: record.description,
            assigneeId: record.assigneeId,
            assignedBy: record.assignedBy,
            clientId: record.clientId,
            eventId: record.eventId,
            dueAt: record.dueAt ? new Date(record.dueAt) : null,
            priority: record.priority,
            rawFilesUrl: record.rawFilesUrl,
            referenceUrl: record.referenceUrl,
            script: record.script,
            referenceLinks: record.referenceLinks,
          })
          .returning({ id: staffTasks.id });
        const id = row!.id;
        await tx.insert(staffTaskUpdates).values({
          taskId: id,
          authorId: record.assignedBy,
          kind: "created",
          toStatus: "todo",
          toAssigneeId: record.assigneeId,
        });
        return id;
      }),
    );
  }

  update(id: string, decide: StaffTaskChangeDecision) {
    return guarded("update the task", () =>
      db.transaction(async (tx) => {
        const current = await selectTask(tx, id, true);
        if (!current) throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
        const changes = decide(current);

        const { dueAt, ...fields } = changes.fields ?? {};
        const set: Partial<typeof staffTasks.$inferInsert> = { ...fields };
        if (dueAt !== undefined) set.dueAt = dueAt ? new Date(dueAt) : null;
        if (changes.assigneeId !== undefined) set.assigneeId = changes.assigneeId;
        if (changes.status !== undefined) set.status = changes.status;
        // The 2-hour due reminder starts over for a new due time, a new assignee or a reopened task.
        const reopened = changes.status !== undefined && changes.status !== "done" && current.status === "done";
        if (dueAt !== undefined || changes.assigneeId !== undefined || reopened) set.dueRemindedAt = null;
        if (Object.keys(set).length === 0 && !changes.entry) return; // nothing to write

        await tx
          .update(staffTasks)
          .set({
            ...set,
            // completed_at follows the status (DB CHECK keeps them in step).
            ...(changes.status !== undefined
              ? { completedAt: changes.status === "done" ? sql`now()` : null }
              : {}),
            version: sql`${staffTasks.version} + 1`,
          })
          .where(eq(staffTasks.id, id));

        if (changes.entry) {
          const statusEntry = changes.status !== undefined;
          const reassigned = changes.assigneeId !== undefined;
          await tx.insert(staffTaskUpdates).values({
            taskId: id,
            authorId: changes.entry.authorId,
            kind: changes.entry.kind,
            fromStatus: statusEntry ? current.status : null,
            toStatus: statusEntry ? changes.status : null,
            fromAssigneeId: reassigned ? current.assigneeId : null,
            toAssigneeId: reassigned ? changes.assigneeId : null,
            comment: changes.entry.comment,
          });
        }
      }),
    );
  }

  addComment(id: string, guard: (current: StaffTaskEntity) => void, authorId: string, comment: string) {
    return guarded("add the comment", async () => {
      // No lock: a comment changes nothing on the task row (and doesn't bump its version).
      const current = await selectTask(db, id);
      if (!current) throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
      guard(current);
      await db.insert(staffTaskUpdates).values({ taskId: id, authorId, kind: "comment", comment });
    });
  }

  delete(id: string, guard: (current: StaffTaskEntity) => void) {
    return guarded("delete the task", () =>
      db.transaction(async (tx) => {
        const current = await selectTask(tx, id, true);
        if (!current) throw new NotFoundError("Task not found", ERROR_CODES.STAFF_TASK_NOT_FOUND);
        guard(current);
        await tx.delete(staffTasks).where(eq(staffTasks.id, id));
        return current;
      }),
    );
  }
}
