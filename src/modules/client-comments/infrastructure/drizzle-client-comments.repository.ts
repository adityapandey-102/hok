import { and, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../../common/database/drizzle-client";
import { InternalError, NotFoundError, AppError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
// Cross-module Infrastructure-only reads (docs/adr/0003): the client's name and
// owner (Clients), event titles (Events), the replier's name (Users).
import { clients } from "../../clients/infrastructure/clients.schema";
import { events } from "../../events/infrastructure/events.schema";
import { profiles } from "../../users/infrastructure/profile.schema";
import { clientCommentHistory, clientComments } from "./client-comments.schema";
import type { ClientCommentEntity, CommentCounts, CommentScope, PortalCommentEntity } from "../domain/client-comment.entity";
import type { ClientCommentsRepositoryPort, CommentChange, CommentListFilters } from "../application/ports/client-comments-repository.port";

const repliers = alias(profiles, "repliers");

/** Staff row: the comment + client name/owner + event title + replier name, in one query. */
const STAFF_SELECT = {
  id: clientComments.id,
  clientId: clientComments.clientId,
  clientName: clients.businessName,
  ownerId: clients.ownerId,
  eventId: clientComments.eventId,
  eventTitle: events.title,
  body: clientComments.body,
  status: clientComments.status,
  reply: clientComments.reply,
  repliedAt: clientComments.repliedAt,
  repliedByName: repliers.fullName,
  version: clientComments.version,
  createdAt: clientComments.createdAt,
  updatedAt: clientComments.updatedAt,
};

/** Portal row: only client-safe columns (no staff names, no version). */
const PORTAL_SELECT = {
  id: clientComments.id,
  eventId: clientComments.eventId,
  eventTitle: events.title,
  body: clientComments.body,
  status: clientComments.status,
  reply: clientComments.reply,
  repliedAt: clientComments.repliedAt,
  createdAt: clientComments.createdAt,
};

type StaffRow = {
  id: string; clientId: string; clientName: string; ownerId: string; eventId: string | null; eventTitle: string | null;
  body: string; status: ClientCommentEntity["status"]; reply: string | null; repliedAt: Date | null; repliedByName: string | null;
  version: number; createdAt: Date; updatedAt: Date;
};

const toEntity = (r: StaffRow): ClientCommentEntity => ({
  ...r,
  repliedAt: r.repliedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

const toPortal = (r: { id: string; eventId: string | null; eventTitle: string | null; body: string; status: PortalCommentEntity["status"]; reply: string | null; repliedAt: Date | null; createdAt: Date }): PortalCommentEntity => ({
  id: r.id,
  eventId: r.eventId,
  eventTitle: r.eventTitle,
  body: r.body,
  status: r.status,
  reply: r.reply,
  repliedAt: r.repliedAt?.toISOString() ?? null,
  createdAt: r.createdAt.toISOString(),
});

async function guarded<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new InternalError(`Failed to ${what}`, error);
  }
}

function scopeCondition(scope: CommentScope): SQL | undefined {
  return scope.kind === "own" ? eq(clients.ownerId, scope.userId) : undefined;
}

function staffQuery() {
  return db
    .select(STAFF_SELECT)
    .from(clientComments)
    .innerJoin(clients, eq(clients.id, clientComments.clientId))
    .leftJoin(events, eq(events.id, clientComments.eventId))
    .leftJoin(repliers, eq(repliers.id, clientComments.repliedBy));
}

export class DrizzleClientCommentsRepository implements ClientCommentsRepositoryPort {
  list(scope: CommentScope, filters: CommentListFilters) {
    return guarded("load comments", async () => {
      const where = and(
        scopeCondition(scope),
        filters.clientId ? eq(clientComments.clientId, filters.clientId) : undefined,
        filters.status ? eq(clientComments.status, filters.status) : inArray(clientComments.status, ["received", "in_progress"]),
      );
      const [rows, [total]] = await Promise.all([
        staffQuery().where(where).orderBy(desc(clientComments.createdAt), desc(clientComments.id)).limit(filters.limit).offset(filters.offset),
        db.select({ n: count() }).from(clientComments).innerJoin(clients, eq(clients.id, clientComments.clientId)).where(where),
      ]);
      return { comments: (rows as StaffRow[]).map(toEntity), total: total?.n ?? 0 };
    });
  }

  counts(scope: CommentScope): Promise<CommentCounts> {
    return guarded("count comments", async () => {
      // One grouped pass over the open set (partial index client_comments_open_idx).
      const [row] = await db
        .select({
          received: sql<number>`count(*) filter (where ${clientComments.status} = 'received')`.mapWith(Number),
          inProgress: sql<number>`count(*) filter (where ${clientComments.status} = 'in_progress')`.mapWith(Number),
        })
        .from(clientComments)
        .innerJoin(clients, eq(clients.id, clientComments.clientId))
        .where(and(scopeCondition(scope), inArray(clientComments.status, ["received", "in_progress"])));
      return { received: row?.received ?? 0, inProgress: row?.inProgress ?? 0 };
    });
  }

  findById(id: string) {
    return guarded("load the comment", async () => {
      const [row] = await staffQuery().where(eq(clientComments.id, id)).limit(1);
      return row ? toEntity(row) : null;
    });
  }

  update(id: string, changedBy: string, decide: (current: ClientCommentEntity) => CommentChange) {
    return guarded("update the comment", async () => {
      await db.transaction(async (tx) => {
        const [locked] = await tx.select({ id: clientComments.id }).from(clientComments).where(eq(clientComments.id, id)).for("update");
        if (!locked) throw new NotFoundError("Comment not found", ERROR_CODES.COMMENT_NOT_FOUND);
        const [row] = await tx
          .select(STAFF_SELECT)
          .from(clientComments)
          .innerJoin(clients, eq(clients.id, clientComments.clientId))
          .leftJoin(events, eq(events.id, clientComments.eventId))
          .leftJoin(repliers, eq(repliers.id, clientComments.repliedBy))
          .where(eq(clientComments.id, id));
        const current = toEntity(row as StaffRow);
        const change = decide(current);

        const statusChanged = change.status !== undefined && change.status !== current.status;
        await tx
          .update(clientComments)
          .set({
            ...(statusChanged ? { status: change.status } : {}),
            ...(change.reply !== undefined
              ? change.reply === null
                ? { reply: null, repliedBy: null, repliedAt: null }
                : { reply: change.reply, repliedBy: changedBy, repliedAt: sql`now()` }
              : {}),
            version: sql`${clientComments.version} + 1`,
          })
          .where(eq(clientComments.id, id));
        if (statusChanged) {
          await tx.insert(clientCommentHistory).values({ commentId: id, fromStatus: current.status, toStatus: change.status!, changedBy });
        }
      });
      const updated = await this.findById(id);
      if (!updated) throw new NotFoundError("Comment not found", ERROR_CODES.COMMENT_NOT_FOUND);
      return updated;
    });
  }

  listForPortal(clientId: string, limit: number, offset: number) {
    return guarded("load your comments", async () => {
      const where = eq(clientComments.clientId, clientId);
      const [rows, [total]] = await Promise.all([
        db
          .select(PORTAL_SELECT)
          .from(clientComments)
          .leftJoin(events, eq(events.id, clientComments.eventId))
          .where(where)
          .orderBy(desc(clientComments.createdAt), desc(clientComments.id))
          .limit(limit)
          .offset(offset),
        db.select({ n: count() }).from(clientComments).where(where),
      ]);
      return { comments: rows.map(toPortal), total: total?.n ?? 0 };
    });
  }

  eventBelongsToClient(clientId: string, eventId: string) {
    return guarded("check the event", async () => {
      const [row] = await db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), eq(events.clientId, clientId))).limit(1);
      return Boolean(row);
    });
  }

  createFromPortal(input: { clientId: string; portalLinkId: string; eventId: string | null; body: string }) {
    return guarded("save your comment", async () => {
      const [inserted] = await db
        .insert(clientComments)
        .values({ clientId: input.clientId, portalLinkId: input.portalLinkId, eventId: input.eventId, body: input.body })
        .returning({ id: clientComments.id });
      const [row] = await db
        .select(PORTAL_SELECT)
        .from(clientComments)
        .leftJoin(events, eq(events.id, clientComments.eventId))
        .where(eq(clientComments.id, inserted!.id));
      return toPortal(row!);
    });
  }
}
