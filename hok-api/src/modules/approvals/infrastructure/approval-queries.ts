import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { db } from "../../../common/database/drizzle-client";
import type { ApprovalRecord, ApprovalRow, ApproverToken } from "../../../domain";
// Cross-module Infrastructure-only reads (ADR 0003): the item an approval is on, its stage, its client, the people's names.
import { clients } from "../../clients/infrastructure/clients.schema";
import { teamIdsOf } from "../../clients/infrastructure/client-team.sql";
import { eventStages, events } from "../../events/infrastructure/events.schema";
import { staffTasks, taskStages } from "../../staff-tasks/infrastructure/staff-tasks.schema";
import { profiles } from "../../users/infrastructure/profile.schema";
import { canDecideSql, canSeeItemSql, whoParams, type ItemSql } from "./approval-access.sql";
import { stageApprovals as a } from "./approvals.schema";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const requester = alias(profiles, "requester");
const decider = alias(profiles, "decider");

/** The item's client: an event's, or a task's (null for a task without one). */
const clientIdExpr = sql`coalesce(${events.clientId}, ${staffTasks.clientId})`;

/** An approval round with everything the response and the per-caller flags need, in one row. */
const SELECT = {
  id: a.id,
  eventId: a.eventId,
  taskId: a.taskId,
  subjectTitle: sql<string>`coalesce(${events.title}, ${staffTasks.title})`,
  clientName: clients.businessName,
  stageId: sql<string>`coalesce(${a.eventStageId}, ${a.taskStageId})`,
  stageName: sql<string>`coalesce(${eventStages.name}, ${taskStages.name})`,
  stagePosition: sql<number>`coalesce(${eventStages.position}, ${taskStages.position})`,
  approvers: sql<ApproverToken[]>`coalesce(${eventStages.approvers}, ${taskStages.approvers})`,
  status: a.status,
  requestNote: a.requestNote,
  requestLink: a.requestLink,
  requestedById: a.requestedBy,
  requestedByName: requester.fullName,
  requestedAt: a.requestedAt,
  decidedById: a.decidedBy,
  decidedByName: decider.fullName,
  decidedVia: a.decidedVia,
  decidedAt: a.decidedAt,
  decisionComment: a.decisionComment,
  version: a.version,
  // What the caller's flags need about the item (never sent to the browser).
  teamIds: teamIdsOf(clientIdExpr),
  taskAssigneeId: staffTasks.assigneeId,
  taskAssignedBy: staffTasks.assignedBy,
};

export function toApprovalRow(r: Awaited<ReturnType<typeof selectRows>>[number]): ApprovalRow {
  const isEvent = r.eventId !== null;
  return {
    record: {
      id: r.id,
      subject: isEvent ? "event" : "task",
      subjectId: (isEvent ? r.eventId : r.taskId) ?? "",
      subjectTitle: r.subjectTitle,
      clientName: r.clientName,
      stageId: r.stageId,
      stageName: r.stageName,
      stagePosition: r.stagePosition,
      approvers: r.approvers,
      status: r.status,
      requestNote: r.requestNote,
      requestLink: r.requestLink,
      requestedById: r.requestedById,
      requestedByName: r.requestedByName,
      requestedAt: r.requestedAt.toISOString(),
      decidedById: r.decidedById,
      decidedByName: r.decidedByName,
      decidedVia: r.decidedVia,
      decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
      decisionComment: r.decisionComment,
      version: r.version,
    },
    teamIds: r.teamIds,
    assigneeId: r.taskAssigneeId,
    assignedBy: r.taskAssignedBy,
  };
}

/** ONE query: the approvals matching `where`, with names, stage, item title, client and team. */
export function selectRows(ex: Executor, where: SQL | undefined, order: SQL[], limit: number, offset: number, lock = false) {
  const query = ex
    .select(SELECT)
    .from(a)
    .leftJoin(events, eq(events.id, a.eventId))
    .leftJoin(staffTasks, eq(staffTasks.id, a.taskId))
    .leftJoin(eventStages, eq(eventStages.id, a.eventStageId))
    .leftJoin(taskStages, eq(taskStages.id, a.taskStageId))
    .leftJoin(clients, eq(clients.id, clientIdExpr))
    .leftJoin(requester, eq(requester.id, a.requestedBy))
    .leftJoin(decider, eq(decider.id, a.decidedBy))
    .where(where)
    .orderBy(...order)
    .limit(limit)
    .offset(offset);
  // FOR UPDATE OF the approval row only: the joined item, stage and people are not locked (a decision must never wait on a move).
  return lock ? query.for("update", { of: a }) : query;
}

/** Most rounds one item's detail returns. */
export const ITEM_APPROVALS_LIMIT = 100;

/** An item's rounds, newest first (max ITEM_APPROVALS_LIMIT): ONE query. */
export async function selectItemApprovals(ex: Executor, subject: "event" | "task", itemId: string): Promise<ApprovalRecord[]> {
  const where = subject === "event" ? eq(a.eventId, itemId) : eq(a.taskId, itemId);
  const rows = await selectRows(ex, where, [desc(a.requestedAt), desc(a.id)], ITEM_APPROVALS_LIMIT, 0);
  return rows.map((r) => toApprovalRow(r).record);
}

export const APPROVAL_VIEWS = ["to_decide", "requested", "all_visible"] as const;
export type ApprovalView = (typeof APPROVAL_VIEWS)[number];

export interface ApprovalListFilters {
  view: ApprovalView;
  status?: "pending" | "approved" | "changes_requested" | "cancelled" | "superseded";
}

/** The approval row as the rules read it (SQL fragments over the joined tables). */
export const ITEM_SQL: ItemSql = {
  isEvent: sql`(${a.eventId} is not null)`,
  clientId: clientIdExpr,
  assigneeId: sql`${staffTasks.assigneeId}`,
  assignedBy: sql`${staffTasks.assignedBy}`,
  approvers: sql`coalesce(${eventStages.approvers}, ${taskStages.approvers})`,
  requestedBy: sql`${a.requestedBy}`,
};

/**
 * The WHERE of an inbox view. Every view is limited to approvals on items the caller can see (the Admin: all);
 * `to_decide` is the pending ones they may decide (token match, not their own request), `requested` the ones they asked for.
 */
function viewConditions(userId: string, role: string, f: ApprovalListFilters): SQL {
  const who = whoParams(userId, role);
  const c: SQL[] = [];
  if (f.view === "to_decide") {
    c.push(eq(a.status, "pending"), canDecideSql(who, ITEM_SQL));
  } else {
    c.push(canSeeItemSql(who, ITEM_SQL));
    if (f.view === "requested") c.push(sql`${a.requestedBy} = ${who.id}`);
    if (f.status) c.push(eq(a.status, f.status));
  }
  return and(...c)!;
}

/** One page of the inbox, worked out in SQL. `to_decide` is oldest first (what has waited longest), the others newest first. */
export async function listApprovalRows(ex: Executor, userId: string, role: string, f: ApprovalListFilters, limit: number, offset: number): Promise<ApprovalRow[]> {
  const order = f.view === "to_decide" ? [asc(a.requestedAt), asc(a.id)] : [desc(a.requestedAt), desc(a.id)];
  return (await selectRows(ex, viewConditions(userId, role, f), order, limit, offset)).map(toApprovalRow);
}

/** The same view's total: ONE count over the same joins and the same conditions. */
export async function countApprovalRows(ex: Executor, userId: string, role: string, f: ApprovalListFilters): Promise<number> {
  const [row] = await ex
    .select({ n: sql<number>`count(*)::int` })
    .from(a)
    .leftJoin(events, eq(events.id, a.eventId))
    .leftJoin(staffTasks, eq(staffTasks.id, a.taskId))
    .leftJoin(eventStages, eq(eventStages.id, a.eventStageId))
    .leftJoin(taskStages, eq(taskStages.id, a.taskStageId))
    .where(viewConditions(userId, role, f));
  return row?.n ?? 0;
}

/** Most people one "approval requested" notification goes to. */
export const APPROVAL_RECIPIENTS_MAX = 50;

/**
 * Everyone who could decide this approval, worked out in ONE query (the same predicate as the inbox: sees the item,
 * matches a token, not their own request unless Admin): active accounts only, at most APPROVAL_RECIPIENTS_MAX.
 */
export async function selectDeciderIds(ex: Executor, approvalId: string): Promise<string[]> {
  const rows = await ex
    .select({ id: profiles.id })
    .from(a)
    .leftJoin(events, eq(events.id, a.eventId))
    .leftJoin(staffTasks, eq(staffTasks.id, a.taskId))
    .leftJoin(eventStages, eq(eventStages.id, a.eventStageId))
    .leftJoin(taskStages, eq(taskStages.id, a.taskStageId))
    .innerJoin(profiles, sql`true`)
    .where(and(eq(a.id, approvalId), eq(profiles.active, true), canDecideSql({ id: sql`${profiles.id}`, role: sql`${profiles.role}` }, ITEM_SQL)))
    .orderBy(asc(profiles.id))
    .limit(APPROVAL_RECIPIENTS_MAX);
  return rows.map((r) => r.id);
}

// -- the portal's reads (client-safe: no staff names, no ids beyond the approval's own) ---------------------

export interface PortalPendingApproval {
  id: string;
  version: number;
  stageName: string;
  requestNote: string | null;
  requestLink: string | null;
  requestedAt: string;
}

export interface PortalApprovalHistoryEntry {
  stageName: string;
  status: "approved" | "changes_requested";
  decidedVia: "staff" | "portal" | null;
  decidedAt: string;
  decisionComment: string | null;
}

/** The request waiting for THIS client on this event (only if its stage lists `client` as an approver), or null. One query. */
export async function selectPortalPending(ex: Executor, clientId: string, eventId: string): Promise<PortalPendingApproval | null> {
  const [row] = await ex
    .select({ id: a.id, version: a.version, stageName: eventStages.name, requestNote: a.requestNote, requestLink: a.requestLink, requestedAt: a.requestedAt })
    .from(a)
    .innerJoin(events, eq(events.id, a.eventId))
    .innerJoin(eventStages, eq(eventStages.id, a.eventStageId))
    .where(and(eq(a.eventId, eventId), eq(events.clientId, clientId), eq(a.status, "pending"), sql`'client' = any(${eventStages.approvers})`))
    .orderBy(desc(a.requestedAt))
    .limit(1);
  return row ? { ...row, requestedAt: row.requestedAt.toISOString() } : null;
}

/** Most decided rounds the portal lists for one event. */
export const PORTAL_APPROVAL_HISTORY_LIMIT = 20;

/** Decided rounds on stages the client approves, newest first. One query. */
export async function selectPortalHistory(ex: Executor, clientId: string, eventId: string): Promise<PortalApprovalHistoryEntry[]> {
  const rows = await ex
    .select({ stageName: eventStages.name, status: a.status, decidedVia: a.decidedVia, decidedAt: a.decidedAt, decisionComment: a.decisionComment })
    .from(a)
    .innerJoin(events, eq(events.id, a.eventId))
    .innerJoin(eventStages, eq(eventStages.id, a.eventStageId))
    .where(
      and(
        eq(a.eventId, eventId),
        eq(events.clientId, clientId),
        inArray(a.status, ["approved", "changes_requested"]),
        sql`'client' = any(${eventStages.approvers})`,
      ),
    )
    .orderBy(desc(a.decidedAt), desc(a.id))
    .limit(PORTAL_APPROVAL_HISTORY_LIMIT);
  return rows.map((r) => ({
    stageName: r.stageName,
    status: r.status as "approved" | "changes_requested",
    decidedVia: r.decidedVia,
    // Decided rows always carry the time; the fallback only satisfies the type.
    decidedAt: (r.decidedAt ?? new Date(0)).toISOString(),
    decisionComment: r.decisionComment,
  }));
}

/** Most pending client approvals the portal's "needs your attention" lists. */
export const PORTAL_ATTENTION_APPROVALS_MAX = 20;

/**
 * Pending approvals the CLIENT can decide (the stage lists `client` as an approver) on these events of THIS client,
 * as event id -> the stage position (the newest request wins). ONE query for any number of events.
 */
export async function selectPortalAwaitingByEvent(ex: Executor, clientId: string, eventIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (eventIds.length === 0) return out;
  const rows = await ex
    .select({ eventId: a.eventId, position: eventStages.position })
    .from(a)
    .innerJoin(events, eq(events.id, a.eventId))
    .innerJoin(eventStages, eq(eventStages.id, a.eventStageId))
    .where(and(inArray(a.eventId, eventIds), eq(events.clientId, clientId), eq(a.status, "pending"), sql`'client' = any(${eventStages.approvers})`))
    .orderBy(asc(a.requestedAt), asc(a.id));
  // Oldest first, so the newest request overwrites.
  for (const r of rows) if (r.eventId) out.set(r.eventId, r.position);
  return out;
}

export interface PortalAttentionApprovalRow {
  eventId: string;
  eventTitle: string;
  stageName: string;
  stagePosition: number;
  requestedAt: string;
}

/** Every request waiting for THIS client, oldest first (what has waited longest), capped. ONE query. */
export async function selectPortalAttentionApprovals(ex: Executor, clientId: string): Promise<PortalAttentionApprovalRow[]> {
  const rows = await ex
    .select({ eventId: events.id, eventTitle: events.title, stageName: eventStages.name, stagePosition: eventStages.position, requestedAt: a.requestedAt })
    .from(a)
    .innerJoin(events, eq(events.id, a.eventId))
    .innerJoin(eventStages, eq(eventStages.id, a.eventStageId))
    .where(and(eq(events.clientId, clientId), eq(a.status, "pending"), sql`'client' = any(${eventStages.approvers})`))
    .orderBy(asc(a.requestedAt), asc(a.id))
    .limit(PORTAL_ATTENTION_APPROVALS_MAX);
  return rows.map((r) => ({ ...r, requestedAt: r.requestedAt.toISOString() }));
}
