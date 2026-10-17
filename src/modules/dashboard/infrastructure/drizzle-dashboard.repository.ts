import { and, asc, desc, eq, gt, gte, lt, ne, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../../../common/database/drizzle-client";
import { AppError, InternalError } from "../../../common/errors/app-error";
import { scanLowerBound } from "../../../domain";
// The Dashboard module owns no table: read-only aggregates over the Clients,
// Events, Staff-tasks, Client-comments and Users modules' tables,
// Infrastructure-to-Infrastructure (ADR 0003).
import { clients } from "../../clients/infrastructure/clients.schema";
import { clientComments } from "../../client-comments/infrastructure/client-comments.schema";
import { eventStages, events } from "../../events/infrastructure/events.schema";
import { staffTaskUpdates, staffTasks } from "../../staff-tasks/infrastructure/staff-tasks.schema";
import { profiles } from "../../users/infrastructure/profile.schema";
import type { DashboardComment, DashboardEvent, DashboardTask, StageGroup, WorkloadRow } from "../domain/dashboard.entity";
import type { DashboardRepositoryPort, Window } from "../application/ports/dashboard-repository.port";

const currentStage = alias(eventStages, "current_stage");
const assignees = alias(profiles, "assignees");
const authors = alias(profiles, "authors");

const EXCERPT = 160;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** `count(*) filter (where …)` as a number. */
const countWhere = (cond: SQL) => sql<number>`(count(*) filter (where ${cond}))::int`;
const notDone = ne(staffTasks.status, "done");
const unresolved = ne(clientComments.status, "solved");

async function guarded<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new InternalError(`Failed to ${what}`, error);
  }
}

export class DrizzleDashboardRepository implements DashboardRepositoryPort {
  taskSummary(assigneeId: string, w: Window) {
    return guarded("load task summary", async () => {
      const [r] = await db
        .select({
          todo: countWhere(eq(staffTasks.status, "todo")),
          in_progress: countWhere(eq(staffTasks.status, "in_progress")),
          blocked: countWhere(eq(staffTasks.status, "blocked")),
          done: countWhere(eq(staffTasks.status, "done")),
          dueToday: countWhere(and(notDone, gte(staffTasks.dueAt, w.todayStart), lt(staffTasks.dueAt, w.tomorrowStart))!),
          overdue: countWhere(and(notDone, lt(staffTasks.dueAt, w.now))!),
        })
        .from(staffTasks)
        .where(eq(staffTasks.assigneeId, assigneeId));
      const { dueToday, overdue, ...counts } = r!;
      return { counts, dueToday, overdue };
    });
  }

  openTasks(filter: { assigneeId?: string; overdueOnly?: boolean }, now: Date, limit: number) {
    return guarded("load open tasks", async () => {
      const c: SQL[] = [notDone];
      if (filter.assigneeId) c.push(eq(staffTasks.assigneeId, filter.assigneeId));
      if (filter.overdueOnly) c.push(lt(staffTasks.dueAt, now));
      const rows = await db
        .select({
          id: staffTasks.id,
          title: staffTasks.title,
          status: staffTasks.status,
          priority: staffTasks.priority,
          dueAt: staffTasks.dueAt,
          clientName: clients.businessName,
          assigneeName: assignees.fullName,
        })
        .from(staffTasks)
        .leftJoin(clients, eq(clients.id, staffTasks.clientId))
        .leftJoin(assignees, eq(assignees.id, staffTasks.assigneeId))
        .where(and(...c))
        .orderBy(sql`${staffTasks.dueAt} asc nulls last`, desc(staffTasks.createdAt), asc(staffTasks.id))
        .limit(limit);
      return rows.map(
        (r): DashboardTask => ({
          ...r,
          dueAt: r.dueAt?.toISOString() ?? null,
          // The viewer's own list doesn't repeat their name.
          assigneeName: filter.assigneeId ? null : r.assigneeName,
        }),
      );
    });
  }

  recentTaskComments(assigneeId: string, limit: number) {
    return guarded("load task comments", async () => {
      const rows = await db
        .select({
          id: staffTaskUpdates.id,
          taskId: staffTasks.id,
          taskTitle: staffTasks.title,
          authorName: authors.fullName,
          comment: staffTaskUpdates.comment,
          createdAt: staffTaskUpdates.createdAt,
        })
        .from(staffTaskUpdates)
        .innerJoin(staffTasks, eq(staffTasks.id, staffTaskUpdates.taskId))
        .leftJoin(authors, eq(authors.id, staffTaskUpdates.authorId))
        .where(
          and(
            eq(staffTasks.assigneeId, assigneeId),
            eq(staffTaskUpdates.kind, "comment"),
            sql`${staffTaskUpdates.authorId} is distinct from ${assigneeId}`,
          ),
        )
        .orderBy(desc(staffTaskUpdates.createdAt), desc(staffTaskUpdates.id))
        .limit(limit);
      return rows.map((r) => ({ ...r, comment: r.comment ?? "", createdAt: r.createdAt.toISOString() }));
    });
  }

  clientSummary(ownerId: string) {
    return guarded("load client summary", async () => {
      const [r] = await db
        .select({
          clientCount: sql<number>`(select count(*)::int from ${clients} where ${clients.ownerId} = ${ownerId} and ${clients.archivedAt} is null)`,
          received: countWhere(eq(clientComments.status, "received")),
          inProgress: countWhere(eq(clientComments.status, "in_progress")),
        })
        .from(clientComments)
        .innerJoin(clients, eq(clients.id, clientComments.clientId))
        .where(and(eq(clients.ownerId, ownerId), unresolved));
      return r!;
    });
  }

  events(range: { from: Date; to: Date }, ownerId: string | undefined, limit: number) {
    return guarded("load dashboard events", async () => {
      const c: SQL[] = [
        lt(events.startsAt, range.to),
        gt(events.endsAt, range.from),
        gte(events.startsAt, scanLowerBound(range.from.toISOString())),
      ];
      if (ownerId) c.push(eq(clients.ownerId, ownerId));
      const rows = await db
        .select({
          id: events.id,
          title: events.title,
          type: events.type,
          state: events.state,
          startsAt: events.startsAt,
          endsAt: events.endsAt,
          timeZone: events.timeZone,
          clientId: events.clientId,
          clientName: clients.businessName,
          currentStageName: currentStage.name,
          currentStagePosition: currentStage.position,
          stageCount: events.stageCount,
        })
        .from(events)
        .innerJoin(clients, eq(clients.id, events.clientId))
        .innerJoin(currentStage, eq(currentStage.id, events.currentStageId))
        .where(and(...c))
        .orderBy(asc(events.startsAt), asc(events.id))
        .limit(limit);
      return rows.map((r): DashboardEvent => ({ ...r, startsAt: r.startsAt.toISOString(), endsAt: r.endsAt.toISOString() }));
    });
  }

  eventsByStage(ownerId: string, now: Date, limit: number) {
    return guarded("load events by stage", async () => {
      const rows = await db
        .select({ stageName: currentStage.name, count: sql<number>`count(*)::int` })
        .from(events)
        .innerJoin(clients, eq(clients.id, events.clientId))
        .innerJoin(currentStage, eq(currentStage.id, events.currentStageId))
        .where(and(eq(clients.ownerId, ownerId), eq(events.state, "active"), gt(events.endsAt, now)))
        .groupBy(currentStage.name)
        .orderBy(sql`count(*) desc`, asc(currentStage.name))
        .limit(limit);
      return rows satisfies StageGroup[];
    });
  }

  latestComments(ownerId: string | undefined, limit: number) {
    return guarded("load latest comments", async () => {
      const c: SQL[] = [unresolved];
      if (ownerId) c.push(eq(clients.ownerId, ownerId));
      const rows = await db
        .select({
          id: clientComments.id,
          clientId: clientComments.clientId,
          clientName: clients.businessName,
          eventTitle: events.title,
          excerpt: sql<string>`left(${clientComments.body}, ${EXCERPT})`,
          status: clientComments.status,
          createdAt: clientComments.createdAt,
        })
        .from(clientComments)
        .innerJoin(clients, eq(clients.id, clientComments.clientId))
        .leftJoin(events, eq(events.id, clientComments.eventId))
        .where(and(...c))
        .orderBy(desc(clientComments.createdAt), desc(clientComments.id))
        .limit(limit);
      return rows.map((r): DashboardComment => ({ ...r, createdAt: r.createdAt.toISOString() }));
    });
  }

  firmTotals(now: Date) {
    return guarded("load firm totals", async () => {
      const [r] = await db
        .select({
          todo: countWhere(eq(staffTasks.status, "todo")),
          in_progress: countWhere(eq(staffTasks.status, "in_progress")),
          blocked: countWhere(eq(staffTasks.status, "blocked")),
          done: countWhere(eq(staffTasks.status, "done")),
          clients: sql<number>`(select count(*)::int from ${clients} where ${clients.archivedAt} is null)`,
          activeEvents: sql<number>`(select count(*)::int from ${events} where ${events.state} = 'active' and ${events.endsAt} > ${now})`,
          unresolvedComments: sql<number>`(select count(*)::int from ${clientComments} where ${clientComments.status} <> 'solved')`,
        })
        .from(staffTasks);
      const { clients: clientCount, activeEvents, unresolvedComments, ...tasksByStatus } = r!;
      const openTasks = tasksByStatus.todo + tasksByStatus.in_progress + tasksByStatus.blocked;
      return { totals: { clients: clientCount, activeEvents, openTasks, unresolvedComments }, tasksByStatus };
    });
  }

  team(now: Date, limit: number) {
    return guarded("load team workload", async () => {
      const weekAgo = new Date(now.getTime() - WEEK_MS);
      const open = countWhere(notDone);
      const overdue = countWhere(and(notDone, lt(staffTasks.dueAt, now))!);
      const rows = await db
        .select({
          userId: profiles.id,
          name: profiles.fullName,
          role: profiles.role,
          open,
          overdue,
          doneThisWeek: countWhere(and(eq(staffTasks.status, "done"), gte(staffTasks.completedAt, weekAgo))!),
        })
        .from(profiles)
        // Only open tasks and ones closed this week: the join never scans old history.
        .leftJoin(staffTasks, and(eq(staffTasks.assigneeId, profiles.id), sql`(${notDone} or ${staffTasks.completedAt} >= ${weekAgo})`))
        .where(and(eq(profiles.active, true), ne(profiles.role, "admin")))
        .groupBy(profiles.id)
        .orderBy(desc(overdue), desc(open), asc(profiles.fullName))
        .limit(limit);
      return rows satisfies WorkloadRow[];
    });
  }
}
