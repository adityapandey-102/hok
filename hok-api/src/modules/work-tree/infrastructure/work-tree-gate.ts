import { and, eq, sql } from "drizzle-orm";
import type { db } from "../../../common/database/drizzle-client";
import type { ParentFacts, ParentRef, WorkChildRow, WorkKind, WorkParentRecord } from "../../../domain";
import { CHILDREN_LIST_MAX } from "../../../domain";
// Cross-module Infrastructure-only reads (ADR 0003): the parent item and its client/team, its stages.
import { clients } from "../../clients/infrastructure/clients.schema";
import { teamIdsOf } from "../../clients/infrastructure/client-team.sql";
import { eventStages, events } from "../../events/infrastructure/events.schema";
import { staffTasks, taskStages } from "../../staff-tasks/infrastructure/staff-tasks.schema";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Parent and child work (round 4): the reads the Events and Staff-tasks repositories make, Infrastructure to
 * Infrastructure. The gate reads are the security-relevant ones: they count EVERY child of a parent, visible to
 * the caller or not, so nobody can pass a stage by not seeing what is open under it.
 *
 * "Open" (blocking) here is the SQL twin of `isOpenEvent` / `isOpenTask` in domain/work-tree.ts -- keep them
 * in step (the integration tests pin both):
 *   task:  status <> 'done'
 *   event: state <> 'cancelled' and not (state = 'active' and on its last stage and the last stage needs no
 *          approval or holds an approved approval)
 */

/** The parent-pointer columns of the child tables for each parent kind (constants, never user input). */
const PARENT_COLUMNS = {
  event: { id: sql.raw("parent_event_id"), stage: sql.raw("parent_event_stage_id") },
  task: { id: sql.raw("parent_task_id"), stage: sql.raw("parent_task_stage_id") },
} as const;

/** The parent's stage table for each parent kind. */
const PARENT_STAGE_TABLE = { event: sql.raw("public.event_stages"), task: sql.raw("public.task_stages") } as const;

/** SQL: the event `e` (current stage joined as `cs`) is FINISHED. */
const EVENT_FINISHED = sql`(e.state = 'active' and cs.position >= e.stage_count and exists (
  select 1 from public.event_stages ls
  where ls.event_id = e.id and ls.position = e.stage_count
    and (cardinality(ls.approvers) = 0 or exists (select 1 from public.stage_approvals a where a.event_stage_id = ls.id and a.status = 'approved'))))`;

/**
 * How many unfinished children hang on each stage of a parent, over BOTH child kinds, in ONE grouped statement
 * (two grouped scans on the partial indexes, unioned). A stage with none is absent from the map. `onlyStageId`
 * narrows it to one stage (the notifier's "is this stage clear now?").
 */
export async function openChildCounts(ex: Executor, parentKind: WorkKind, parentId: string, onlyStageId?: string): Promise<Map<string, number>> {
  const col = PARENT_COLUMNS[parentKind];
  const stageFilter = onlyStageId ? sql`and e.${col.stage} = ${onlyStageId}` : sql``;
  const taskStageFilter = onlyStageId ? sql`and t.${col.stage} = ${onlyStageId}` : sql``;
  const result = await ex.execute(sql`
    select stage_id, sum(n)::int as n from (
      select e.${col.stage} as stage_id, count(*) as n
      from public.events e
      join public.event_stages cs on cs.id = e.current_stage_id
      where e.${col.id} = ${parentId} ${stageFilter}
        and e.state <> 'cancelled' and not ${EVENT_FINISHED}
      group by 1
      union all
      select t.${col.stage} as stage_id, count(*) as n
      from public.staff_tasks t
      where t.${col.id} = ${parentId} ${taskStageFilter} and t.status <> 'done'
      group by 1
    ) x
    where stage_id is not null
    group by stage_id`);
  const counts = new Map<string, number>();
  for (const r of result.rows as { stage_id: string; n: number }[]) counts.set(r.stage_id, Number(r.n));
  return counts;
}

/** A child's own parent pointer, or null for a top-level item. One indexed read by primary key. */
export async function childParentRef(ex: Executor, kind: WorkKind, childId: string): Promise<ParentRef | null> {
  const table = kind === "event" ? events : staffTasks;
  const [row] = await ex
    .select({
      parentEventId: table.parentEventId,
      parentTaskId: table.parentTaskId,
      parentEventStageId: table.parentEventStageId,
      parentTaskStageId: table.parentTaskStageId,
    })
    .from(table)
    .where(eq(table.id, childId))
    .limit(1);
  return row ? parentRefOf(row) : null;
}

/** The pair of pointer columns of a row -> the ParentRef; null unless a parent and its stage are both set. */
export function parentRefOf(row: {
  parentEventId: string | null;
  parentTaskId: string | null;
  parentEventStageId: string | null;
  parentTaskStageId: string | null;
}): ParentRef | null {
  if (row.parentEventId && row.parentEventStageId) return { kind: "event", id: row.parentEventId, stageId: row.parentEventStageId };
  if (row.parentTaskId && row.parentTaskStageId) return { kind: "task", id: row.parentTaskId, stageId: row.parentTaskStageId };
  return null;
}

/** The columns a child row writes for its parent (all null for a top-level item) and its depth. */
export function parentColumns(parent: ParentRef | null, parentDepth: number) {
  return {
    parentEventId: parent?.kind === "event" ? parent.id : null,
    parentEventStageId: parent?.kind === "event" ? parent.stageId : null,
    parentTaskId: parent?.kind === "task" ? parent.id : null,
    parentTaskStageId: parent?.kind === "task" ? parent.stageId : null,
    depth: parent ? parentDepth + 1 : 1,
  };
}

/**
 * The parent as the child rules need it. With `lock`, the parent's own row is read FOR SHARE: a concurrent move
 * (FOR UPDATE) waits for the child to commit, then sees it in its open-children count -- and a child can't be
 * created in the middle of a move. Readers aren't blocked. Null if there is no such parent.
 */
export async function selectParentFacts(ex: Executor, kind: WorkKind, id: string, lock: boolean): Promise<ParentFacts | null> {
  if (kind === "event") {
    const query = ex
      .select({
        id: events.id,
        title: events.title,
        depth: events.depth,
        state: events.state,
        clientId: clients.id,
        clientStatus: clients.status,
        teamIds: teamIdsOf(clients.id),
        parentEventId: events.parentEventId,
        parentTaskId: events.parentTaskId,
        parentEventStageId: events.parentEventStageId,
        parentTaskStageId: events.parentTaskStageId,
      })
      .from(events)
      .innerJoin(clients, eq(clients.id, events.clientId))
      .where(eq(events.id, id))
      .limit(1);
    const [row] = lock ? await query.for("share", { of: events }) : await query;
    if (!row) return null;
    const stages = await ex.select({ id: eventStages.id }).from(eventStages).where(eq(eventStages.eventId, id));
    return {
      kind,
      id: row.id,
      title: row.title,
      depth: row.depth,
      state: row.state,
      clientId: row.clientId,
      clientStatus: row.clientStatus,
      teamIds: row.teamIds,
      assigneeId: null,
      assignedBy: null,
      stageIds: stages.map((s) => s.id),
      parent: parentRefOf(row),
    };
  }
  const query = ex
    .select({
      id: staffTasks.id,
      title: staffTasks.title,
      depth: staffTasks.depth,
      status: staffTasks.status,
      clientId: staffTasks.clientId,
      clientStatus: clients.status,
      teamIds: teamIdsOf(staffTasks.clientId),
      assigneeId: staffTasks.assigneeId,
      assignedBy: staffTasks.assignedBy,
      parentEventId: staffTasks.parentEventId,
      parentTaskId: staffTasks.parentTaskId,
      parentEventStageId: staffTasks.parentEventStageId,
      parentTaskStageId: staffTasks.parentTaskStageId,
    })
    .from(staffTasks)
    .leftJoin(clients, eq(clients.id, staffTasks.clientId))
    .where(eq(staffTasks.id, id))
    .limit(1);
  const [row] = lock ? await query.for("share", { of: staffTasks }) : await query;
  if (!row) return null;
  const stages = await ex.select({ id: taskStages.id }).from(taskStages).where(eq(taskStages.taskId, id));
  return {
    kind,
    id: row.id,
    title: row.title,
    depth: row.depth,
    state: row.status,
    clientId: row.clientId,
    clientStatus: row.clientStatus,
    teamIds: row.teamIds,
    assigneeId: row.assigneeId,
    assignedBy: row.assignedBy,
    stageIds: stages.map((s) => s.id),
    parent: parentRefOf(row),
  };
}

/**
 * A parent and one of its stages, for a detail's `parent` (with what the visibility check needs; the service
 * turns it into the stub, or null, per caller); null if either is gone. One query.
 */
export async function selectParentRecord(ex: Executor, parent: ParentRef): Promise<WorkParentRecord | null> {
  if (parent.kind === "event") {
    const [row] = await ex
      .select({ title: events.title, stageName: eventStages.name, teamIds: teamIdsOf(events.clientId) })
      .from(events)
      .innerJoin(eventStages, eq(eventStages.eventId, events.id))
      .where(and(eq(events.id, parent.id), eq(eventStages.id, parent.stageId)))
      .limit(1);
    return row ? { ...parent, ...row, assigneeId: null, assignedBy: null } : null;
  }
  const [row] = await ex
    .select({
      title: staffTasks.title,
      stageName: taskStages.name,
      teamIds: teamIdsOf(staffTasks.clientId),
      assigneeId: staffTasks.assigneeId,
      assignedBy: staffTasks.assignedBy,
    })
    .from(staffTasks)
    .innerJoin(taskStages, eq(taskStages.taskId, staffTasks.id))
    .where(and(eq(staffTasks.id, parent.id), eq(taskStages.id, parent.stageId)))
    .limit(1);
  return row ? { ...parent, ...row } : null;
}

interface ChildSqlRow {
  id: string;
  title: string;
  stage_id: string;
  stage_name: string;
  stage_position: number;
  cur_name: string;
  cur_pos: number;
  stage_count: number;
  finished: boolean;
  state: string | null;
  status: string | null;
  assignee_name: string | null;
  assignee_id: string | null;
  assigned_by: string | null;
  team_ids: string[];
  created_at: Date;
  total: number;
  /** How many of the parent's children of this kind on this row's parent stage are unfinished (a window count, before the limit). */
  stage_open: number;
}

/**
 * A parent's children for its detail: at most CHILDREN_LIST_MAX of each kind, in two statements (events, tasks),
 * with each kind's total and -- per parent stage -- its unfinished count from window counts taken BEFORE the limit.
 * That gives the detail its `stages[].openChildren` with no third statement. The rows come unfinished-first so a
 * stage with unfinished children always shows up in the capped list. Every child is returned with what the
 * visibility rules need; the service filters per caller (domain `visibleChildren`) and counts the rest as hidden --
 * details of a child the caller can't see never leave the service.
 */
export async function selectChildren(
  ex: Executor,
  parentKind: WorkKind,
  parentId: string,
): Promise<{ rows: WorkChildRow[]; total: number; openByStage: Map<string, number> }> {
  const col = PARENT_COLUMNS[parentKind];
  const parentStages = PARENT_STAGE_TABLE[parentKind];
  const eventOpen = sql`(e.state <> 'cancelled' and not ${EVENT_FINISHED})`;
  const [eventRows, taskRows] = await Promise.all([
    ex.execute(sql`
      select e.id, e.title, e.${col.stage} as stage_id, ps.name as stage_name, ps.position as stage_position,
             cs.name as cur_name, cs.position as cur_pos, e.stage_count, e.state, null::text as status,
             ${EVENT_FINISHED} as finished, null::text as assignee_name, null::uuid as assignee_id, null::uuid as assigned_by,
             array(select m.profile_id from public.client_members m where m.client_id = e.client_id) as team_ids,
             e.created_at, (count(*) over ())::int as total,
             (count(*) filter (where ${eventOpen}) over (partition by e.${col.stage}))::int as stage_open
      from public.events e
      join public.event_stages cs on cs.id = e.current_stage_id
      join ${parentStages} ps on ps.id = e.${col.stage}
      where e.${col.id} = ${parentId}
      order by ${eventOpen} desc, ps.position, e.created_at, e.id
      limit ${CHILDREN_LIST_MAX}`),
    ex.execute(sql`
      select t.id, t.title, t.${col.stage} as stage_id, ps.name as stage_name, ps.position as stage_position,
             cs.name as cur_name, cs.position as cur_pos, t.stage_count, null::text as state, t.status,
             (t.status = 'done') as finished, p.full_name as assignee_name, t.assignee_id, t.assigned_by,
             array(select m.profile_id from public.client_members m where m.client_id = t.client_id) as team_ids,
             t.created_at, (count(*) over ())::int as total,
             (count(*) filter (where t.status <> 'done') over (partition by t.${col.stage}))::int as stage_open
      from public.staff_tasks t
      join public.task_stages cs on cs.id = t.current_stage_id
      join ${parentStages} ps on ps.id = t.${col.stage}
      left join public.profiles p on p.id = t.assignee_id
      where t.${col.id} = ${parentId}
      order by (t.status <> 'done') desc, ps.position, t.created_at, t.id
      limit ${CHILDREN_LIST_MAX}`),
  ]);
  const toRow = (kind: WorkKind) => (r: ChildSqlRow): WorkChildRow => ({
    kind,
    id: r.id,
    title: r.title,
    stageId: r.stage_id,
    stageName: r.stage_name,
    stagePosition: Number(r.stage_position),
    currentStageName: r.cur_name,
    currentPosition: Number(r.cur_pos),
    stageCount: Number(r.stage_count),
    status: r.status,
    state: r.state,
    finished: r.finished,
    assigneeName: r.assignee_name,
    createdAt: new Date(r.created_at).toISOString(),
    teamIds: r.team_ids ?? [],
    assigneeId: r.assignee_id,
    assignedBy: r.assigned_by,
  });
  const events_ = eventRows.rows as unknown as ChildSqlRow[];
  const tasks_ = taskRows.rows as unknown as ChildSqlRow[];
  // Per parent stage, the unfinished events plus the unfinished tasks (each row of a stage carries that stage's count).
  const openByStage = new Map<string, number>();
  for (const kindRows of [events_, tasks_]) {
    const perStage = new Map<string, number>();
    for (const r of kindRows) perStage.set(r.stage_id, Number(r.stage_open));
    for (const [stageId, n] of perStage) if (n > 0) openByStage.set(stageId, (openByStage.get(stageId) ?? 0) + n);
  }
  return {
    rows: [...events_.map(toRow("event")), ...tasks_.map(toRow("task"))],
    total: (events_[0] ? Number(events_[0].total) : 0) + (tasks_[0] ? Number(tasks_[0].total) : 0),
    openByStage,
  };
}
