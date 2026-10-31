import { and, eq, gte, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { containsPattern } from "../../../common/database/like-pattern";
// The Reports module owns no table: read-only aggregates over other modules'
// tables, Infrastructure-to-Infrastructure (ADR 0003).
import { assets } from "../../assets/infrastructure/assets.schema";
import { clientComments } from "../../client-comments/infrastructure/client-comments.schema";
import { clientTodos } from "../../client-todos/infrastructure/client-todos.schema";
import { clients } from "../../clients/infrastructure/clients.schema";
import { EVENT_STATES, EVENT_TYPES, type EventState, type EventType } from "../../events/domain/event.entity";
import { eventStageHistory, events } from "../../events/infrastructure/events.schema";
import { staffTasks } from "../../staff-tasks/infrastructure/staff-tasks.schema";
import { profiles } from "../../users/infrastructure/profile.schema";
import { COMMENT_STATUSES, type CommentStatus } from "../../client-comments/domain/client-comment.entity";
import type { MonthWeek, MonthWindow } from "../domain/report.entity";
import type {
  ClientFigures,
  ReportRepositoryPort,
  StaffFigures,
  TeamStatusFilter,
  TeamStatusRowData } from "../application/ports/report-repository.port";
import { guarded } from "../../../common/database/guarded";

/** `count(*) filter (where …)` as a number. */
const countWhere = (cond: SQL) => sql<number>`(count(*) filter (where ${cond}))::int`;
const inRange = (col: Parameters<typeof gte>[0], from: Date, to: Date) => and(gte(col, from), lt(col, to))!;

/**
 * The team-status rows as ONE statement: each activity source is aggregated
 * once over the last 24 h (created_at / actor indexes), open tasks once over
 * the live set, then joined to the filtered people. Never a subquery per row.
 * The working rule here MUST match `teamStatus()` in report.rules.ts.
 */
function teamStatusRows(filter: TeamStatusFilter, since: Date, now: Date): SQL {
  const search = filter.search ? sql` and p.full_name ilike ${containsPattern(filter.search)}` : sql``;
  const role = filter.role ? sql` and p.role = ${filter.role}` : sql``;
  const status = filter.status
    ? sql` where ${filter.status === "working" ? sql`` : sql`not `}(open_tasks > 0 and (coalesce(last_seen_at >= ${since}, false) or activity > 0))`
    : sql``;
  return sql`
    with t as (
      select assignee_id as uid, count(*)::int as open_tasks, (count(*) filter (where due_at < ${now}))::int as overdue
      from public.staff_tasks where status <> 'done' group by assignee_id
    ), a_tasks as (
      select author_id as uid, count(*)::int as n from public.staff_task_updates
      where created_at >= ${since} and author_id is not null group by author_id
    ), a_stage as (
      select changed_by as uid, count(*)::int as n from public.event_stage_history
      where created_at >= ${since} and changed_by is not null group by changed_by
    ), a_audit as (
      select actor_id as uid, count(*)::int as n from public.audit_log
      where created_at >= ${since} and actor_id is not null group by actor_id
    ), base as (
      select p.id, p.full_name, p.role, p.last_seen_at,
        coalesce(t.open_tasks, 0) as open_tasks, coalesce(t.overdue, 0) as overdue,
        coalesce(a_tasks.n, 0) + coalesce(a_stage.n, 0) + coalesce(a_audit.n, 0) as activity
      from public.profiles p
      left join t on t.uid = p.id
      left join a_tasks on a_tasks.uid = p.id
      left join a_stage on a_stage.uid = p.id
      left join a_audit on a_audit.uid = p.id
      where p.active and p.role <> 'admin'${search}${role}
    ), filtered as (select * from base${status})`;
}

export class DrizzleReportRepository implements ReportRepositoryPort {
  teamStatus(filter: TeamStatusFilter, since: Date, now: Date, limit: number, offset: number) {
    return guarded("load team status", async () => {
      const res = await db.execute(sql`${teamStatusRows(filter, since, now)}
        select id, full_name, role, last_seen_at, open_tasks, overdue, activity from filtered
        order by overdue desc, open_tasks desc, full_name asc, id asc
        limit ${limit} offset ${offset}`);
      return res.rows.map(
        (r): TeamStatusRowData => ({
          userId: r.id as string,
          name: r.full_name as string,
          role: r.role as TeamStatusRowData["role"],
          lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at as string | Date) : null,
          openTasks: Number(r.open_tasks),
          overdue: Number(r.overdue),
          activityLast24h: Number(r.activity),
        }),
      );
    });
  }

  teamStatusCount(filter: TeamStatusFilter, since: Date, now: Date) {
    return guarded("count team status", async () => {
      const res = await db.execute(sql`${teamStatusRows(filter, since, now)} select count(*)::int as n from filtered`);
      return Number((res.rows[0] as { n: number } | undefined)?.n ?? 0);
    });
  }

  person(userId: string) {
    return guarded("load person", async () => {
      const [r] = await db
        .select({ userId: profiles.id, name: profiles.fullName, role: profiles.role, lastSeenAt: profiles.lastSeenAt })
        .from(profiles)
        .where(eq(profiles.id, userId));
      return r ?? null;
    });
  }

  staffFigures(userId: string, month: MonthWindow, weeks: MonthWeek[], now: Date) {
    return guarded("load staff report", async () => {
      const from = new Date(month.from);
      const to = new Date(month.to);
      const assignedIn = inRange(staffTasks.createdAt, from, to);
      const completedIn = inRange(staffTasks.completedAt, from, to);
      const notDone = sql`${staffTasks.status} <> 'done'`;
      const weekCols: Record<string, SQL<number>> = {};
      weeks.forEach((w, i) => {
        weekCols[`a${i}`] = countWhere(inRange(staffTasks.createdAt, new Date(w.from), new Date(w.to)));
        weekCols[`c${i}`] = countWhere(inRange(staffTasks.completedAt, new Date(w.from), new Date(w.to)));
      });
      const [r] = await db
        .select({
          assigned: countWhere(assignedIn),
          completed: countWhere(completedIn),
          onTime: countWhere(and(completedIn, or(sql`${staffTasks.dueAt} is null`, sql`${staffTasks.completedAt} <= ${staffTasks.dueAt}`))!),
          avgDays: sql<number | null>`round((extract(epoch from avg(${staffTasks.completedAt} - ${staffTasks.createdAt}) filter (where ${completedIn})) / 86400)::numeric, 1)::float8`,
          openNow: countWhere(notDone),
          overdueNow: countWhere(and(notDone, lt(staffTasks.dueAt, now))!),
          ...weekCols,
        })
        .from(staffTasks)
        // Month's tasks (assignee+created / assignee+completed indexes) and the person's live set.
        .where(and(eq(staffTasks.assigneeId, userId), or(assignedIn, completedIn, notDone)));
      const row = r as unknown as Record<string, number | null>;
      const num = (k: string) => Number(row[k] ?? 0);
      const completed = num("completed");
      const onTime = num("onTime");
      return {
        assigned: num("assigned"),
        completed,
        onTime,
        late: completed - onTime,
        avgDaysToComplete: row.avgDays === null || row.avgDays === undefined ? null : Number(row.avgDays),
        openNow: num("openNow"),
        overdueNow: num("overdueNow"),
        weeks: weeks.map((_, i) => ({ assigned: num(`a${i}`), completed: num(`c${i}`) })),
      } satisfies StaffFigures;
    });
  }

  client(clientId: string) {
    return guarded("load client", async () => {
      const [r] = await db
        .select({ clientId: clients.id, name: clients.businessName, ownerId: clients.ownerId, ownerName: profiles.fullName })
        .from(clients)
        .innerJoin(profiles, eq(profiles.id, clients.ownerId))
        .where(eq(clients.id, clientId));
      return r ?? null;
    });
  }

  clientFigures(clientId: string, month: MonthWindow) {
    return guarded("load client report", async () => {
      const from = new Date(month.from);
      const to = new Date(month.to);
      const [ev, moves, cm, td, as] = await Promise.all([
        // Events that START in the month ((client_id, starts_at) index).
        (() => {
          const cols: Record<string, SQL<number>> = { total: sql<number>`count(*)::int` };
          for (const s of EVENT_STATES) cols[`s_${s}`] = countWhere(eq(events.state, s));
          for (const t of EVENT_TYPES) cols[`t_${t}`] = countWhere(eq(events.type, t));
          return db
            .select(cols)
            .from(events)
            .where(and(eq(events.clientId, clientId), inRange(events.startsAt, from, to)));
        })(),
        // Stage moves made in the month on this client's events (the creation entry has no from_stage_id).
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(eventStageHistory)
          .innerJoin(events, eq(events.id, eventStageHistory.eventId))
          .where(and(eq(events.clientId, clientId), inRange(eventStageHistory.createdAt, from, to), sql`${eventStageHistory.fromStageId} is not null`)),
        // Comments received in the month.
        (() => {
          const cols: Record<string, SQL<number | null>> = {
            received: sql<number>`count(*)::int`,
            replied: sql<number>`count(${clientComments.repliedAt})::int`,
            avgHours: sql<number | null>`round((extract(epoch from avg(${clientComments.repliedAt} - ${clientComments.createdAt})) / 3600)::numeric, 1)::float8`,
          };
          for (const s of COMMENT_STATUSES) cols[`c_${s}`] = countWhere(eq(clientComments.status, s));
          return db
            .select(cols)
            .from(clientComments)
            .where(and(eq(clientComments.clientId, clientId), inRange(clientComments.createdAt, from, to)));
        })(),
        // To-dos finished in the month, and still open now.
        db
          .select({
            done: countWhere(and(eq(clientTodos.status, "done"), inRange(clientTodos.completedAt, from, to))!),
            open: countWhere(sql`${clientTodos.status} <> 'done'`),
          })
          .from(clientTodos)
          .where(and(eq(clientTodos.clientId, clientId), or(sql`${clientTodos.status} <> 'done'`, inRange(clientTodos.completedAt, from, to)))),
        // Assets added in the month (not deleted).
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(assets)
          .where(and(eq(assets.clientId, clientId), sql`${assets.deletedAt} is null`, inRange(assets.createdAt, from, to))),
      ]);
      const e = ev[0] as unknown as Record<string, number>;
      const c = cm[0] as unknown as Record<string, number | null>;
      const byState = Object.fromEntries(EVENT_STATES.map((s) => [s, Number(e[`s_${s}`] ?? 0)])) as Record<EventState, number>;
      const byType = Object.fromEntries(EVENT_TYPES.map((t) => [t, Number(e[`t_${t}`] ?? 0)])) as Record<EventType, number>;
      const byStatus = Object.fromEntries(COMMENT_STATUSES.map((s) => [s, Number(c[`c_${s}`] ?? 0)])) as Record<CommentStatus, number>;
      return {
        events: { total: Number(e.total ?? 0), byState, byType },
        stageMoves: Number(moves[0]?.n ?? 0),
        comments: {
          received: Number(c.received ?? 0),
          solved: byStatus.solved,
          replied: Number(c.replied ?? 0),
          avgFirstReplyHours: c.avgHours === null || c.avgHours === undefined ? null : Number(c.avgHours),
          byStatus,
        },
        todos: { done: Number(td[0]?.done ?? 0), open: Number(td[0]?.open ?? 0) },
        assetsAdded: Number(as[0]?.n ?? 0),
      } satisfies ClientFigures;
    });
  }
}
