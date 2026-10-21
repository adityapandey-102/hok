import { sql, type SQL } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { AppError, InternalError } from "../../../common/errors/app-error";
import {
  AUDIT_PREFIXES_BY_KIND,
  type ActivityFilter,
  type ActivityKind,
  type ActivityRow,
  type ActivitySource,
} from "../domain/activity.entity";
import type { ActivityRepositoryPort } from "../application/ports/activity-repository.port";

// The Activity module owns no table: a read-only feed over audit_log,
// event_stage_history, staff_task_updates, client_comments and
// client_comment_history (Infrastructure-to-Infrastructure, ADR 0003). Table
// names are literals here because the query is raw SQL (a UNION ALL).

const UUID_RE = "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";
/** text -> uuid, or null when it isn't one (audit_log.entity_id is free text). */
const safeUuid = (col: string) => sql.raw(`(case when ${col} ~* '${UUID_RE}' then ${col}::uuid end)`);

const KINDS = Object.keys(AUDIT_PREFIXES_BY_KIND) as ActivityKind[];
const prefixTest = (kind: ActivityKind, col: string) =>
  AUDIT_PREFIXES_BY_KIND[kind].map((p) => `starts_with(${col}, '${p}')`).join(" or ");

/** CASE mapping an audit action to its kind (constants only, so sql.raw is safe). */
const auditKindCase = sql.raw(`case ${KINDS.map((k) => `when ${prefixTest(k, "al.action")} then '${k}'`).join(" ")} end`);

/** One UNION ALL branch per source; every branch has the same 12 columns. */
function branches(f: ActivityFilter): SQL[] {
  const from = f.from.toISOString();
  const to = f.to.toISOString();
  const within = (col: string) => sql`${sql.raw(col)} >= ${from}::timestamptz and ${sql.raw(col)} <= ${to}::timestamptz`;
  const by = (col: string) => (f.actorId ? sql` and ${sql.raw(col)} = ${f.actorId}::uuid` : sql``);
  const wants = (kind: ActivityKind) => f.kind === "all" || f.kind === kind;
  const out: SQL[] = [];

  // 1. audit_log: the prefixes of the wanted kind(s) only. Stage moves, task status/comment/reopen
  // and comment status changes are covered by their typed history, so their audit twins are skipped.
  const auditKinds = KINDS.filter(wants);
  const auditPrefixes = auditKinds.map((k) => `(${prefixTest(k, "al.action")})`).join(" or ");
  out.push(sql`select 'a:' || al.id::text as id, al.created_at as at, ${auditKindCase} as kind, 'audit'::text as source,
      al.actor_id as actor_id, al.action as action, al.entity_type as entity_type, al.entity_id as entity_id,
      al.metadata->>'clientId' as m_client, al.metadata->>'to' as m_to, null::text as t1, null::text as t2
    from public.audit_log al
    where ${within("al.created_at")}${by("al.actor_id")}
      and (${sql.raw(auditPrefixes)})
      and al.action <> 'staff_task.reassigned'
      and (al.action <> 'comment.updated' or al.metadata->>'replied' = 'true')`);

  if (wants("events")) {
    // The first stage (from_stage_id null) is event creation, already an audit row.
    out.push(sql`select 's:' || h.id::text, h.created_at, 'events'::text, 'stage'::text, h.changed_by, 'stage_moved'::text,
        'event'::text, h.event_id::text, null::text, null::text, h.to_stage_id::text, null::text
      from public.event_stage_history h
      where ${within("h.created_at")}${by("h.changed_by")} and h.from_stage_id is not null`);
  }
  if (wants("tasks")) {
    // "created" is already an audit row.
    out.push(sql`select 't:' || u.id::text, u.created_at, 'tasks'::text, 'task'::text, u.author_id, u.kind,
        'staff_task'::text, u.task_id::text, null::text, u.to_assignee_id::text, u.from_status, u.to_status
      from public.staff_task_updates u
      where ${within("u.created_at")}${by("u.author_id")} and u.kind in ('status', 'comment', 'reassigned', 'reopened')`);
  }
  if (wants("comments")) {
    // A client's own comment has no staff actor, so an actor filter excludes it.
    if (!f.actorId) {
      out.push(sql`select 'c:' || c.id::text, c.created_at, 'comments'::text, 'comment'::text, null::uuid, 'comment_posted'::text,
          'comment'::text, c.id::text, c.client_id::text, null::text, null::text, null::text
        from public.client_comments c
        where ${within("c.created_at")}`);
    }
    out.push(sql`select 'h:' || h.id::text, h.created_at, 'comments'::text, 'comment_status'::text, h.changed_by, 'comment_status'::text,
        'comment'::text, h.comment_id::text, null::text, null::text, h.from_status, h.to_status
      from public.client_comment_history h
      where ${within("h.created_at")}${by("h.changed_by")}`);
  }
  return out;
}

function union(f: ActivityFilter): SQL {
  return sql.join(branches(f), sql` union all `);
}

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : null);

function toRow(r: Raw): ActivityRow {
  return {
    id: String(r.id),
    at: new Date(r.at as string | Date),
    kind: r.kind as ActivityKind,
    source: r.source as ActivitySource,
    action: String(r.action),
    actorId: str(r.actor_id),
    actorName: str(r.actor_name),
    clientId: str(r.client_id),
    clientName: str(r.client_name),
    eventId: str(r.event_id),
    eventTitle: str(r.event_title),
    taskId: str(r.task_id),
    taskTitle: str(r.task_title),
    subjectName: str(r.subject_name),
    targetUserId: str(r.target_user_id),
    targetUserName: str(r.target_user_name),
    assetTitle: str(r.asset_title),
    todoTitle: str(r.todo_title),
    templateName: str(r.template_name),
    stageName: str(r.stage_name),
    fromStatus: str(r.from_status),
    toStatus: str(r.to_status),
  };
}

async function guarded<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new InternalError(`Failed to ${what}`, error);
  }
}

export class DrizzleActivityRepository implements ActivityRepositoryPort {
  /**
   * ONE query: the bounded, filtered union is ordered and limited FIRST;
   * names are then joined by primary key for just the page's rows, so a page
   * of 5 and a page of 50 cost the same.
   */
  page(filter: ActivityFilter, limit: number, offset: number) {
    return guarded("load the activity log", async () => {
      const res = await db.execute(sql`
        with p as (
          select * from (${union(filter)}) u order by u.at desc, u.id limit ${limit} offset ${offset}
        ), r as (
          select p.*, ${safeUuid("p.entity_id")} as eid, ${safeUuid("p.m_client")} as mcl,
                 ${safeUuid("p.m_to")} as mto, ${safeUuid("p.t1")} as t1u
          from p
        )
        select r.id, r.at, r.kind, r.source, r.action, r.actor_id, a.full_name as actor_name,
               c.id::text as client_id, c.business_name as client_name,
               e.id::text as event_id, e.title as event_title,
               t.id::text as task_id, t.title as task_title,
               su.full_name as subject_name, tu.id::text as target_user_id, tu.full_name as target_user_name,
               s.title as asset_title, td.title as todo_title, st.name as template_name, es.name as stage_name,
               r.t1 as from_status, r.t2 as to_status
        from r
        left join public.profiles a on a.id = r.actor_id
        left join public.client_comments cc on r.entity_type = 'comment' and cc.id = r.eid
        left join public.client_todos td on r.entity_type = 'client_todo' and td.id = r.eid
        left join public.events e on r.entity_type = 'event' and e.id = r.eid
        left join public.staff_tasks t on r.entity_type = 'staff_task' and t.id = r.eid
        left join public.profiles tu on r.entity_type = 'user' and tu.id = r.eid
        left join public.profiles su on su.id = r.mto
        left join public.assets s on r.entity_type = 'asset' and s.id = r.eid
        left join public.stage_templates st on r.entity_type = 'stage_template' and st.id = r.eid
        left join public.event_stages es on r.source = 'stage' and es.id = r.t1u
        left join public.clients c on c.id = coalesce(case when r.entity_type = 'client' then r.eid end, r.mcl, cc.client_id, td.client_id, e.client_id, t.client_id)
        order by r.at desc, r.id`);
      return (res.rows as Raw[]).map(toRow);
    });
  }

  count(filter: ActivityFilter) {
    return guarded("count the activity log", async () => {
      const res = await db.execute(sql`select count(*)::int as n from (${union(filter)}) u`);
      return Number(res.rows[0]?.n ?? 0);
    });
  }
}
