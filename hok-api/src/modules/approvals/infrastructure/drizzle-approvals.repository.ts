import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { guarded } from "../../../common/database/guarded";
import { ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import type { ApprovalRow } from "../../../domain";
// Cross-module Infrastructure-only reads and locks (ADR 0003): the item an approval is on, its current stage,
// its client and team.
import { clients } from "../../clients/infrastructure/clients.schema";
import { notifiedTeamIdsOf, teamIdsOf } from "../../clients/infrastructure/client-team.sql";
import { eventStages, events } from "../../events/infrastructure/events.schema";
import { staffTasks, taskStages } from "../../staff-tasks/infrastructure/staff-tasks.schema";
import type { ApprovalItemFacts } from "../domain/approval.entity";
import type {
  ApprovalListFilters,
  ApprovalsRepositoryPort,
  ApprovalWrite,
  NewApproval,
} from "../application/ports/approvals-repository.port";
import { countApprovalRows, listApprovalRows, selectDeciderIds, selectRows, toApprovalRow } from "./approval-queries";
import { stageApprovals } from "./approvals.schema";

/** Postgres 23505 on the one-pending partial unique index (the driver may wrap it in `cause`). */
function isOnePendingViolation(err: unknown): boolean {
  const e = err as { code?: unknown; constraint?: unknown; cause?: { code?: unknown; constraint?: unknown } } | null;
  const code = e?.code ?? e?.cause?.code;
  const constraint = e?.constraint ?? e?.cause?.constraint;
  return code === "23505" && typeof constraint === "string" && constraint.startsWith("stage_approvals_one_pending");
}

/**
 * Approvals through Drizzle. A request locks the ITEM row (so it never interleaves with a move); a decision or a
 * cancel locks the APPROVAL row. Lists and counts are one query each, with the visibility and "may decide" rules
 * in the WHERE (never filtered in memory after paging).
 */
export class DrizzleApprovalsRepository implements ApprovalsRepositoryPort {
  request(input: NewApproval, guard: (item: ApprovalItemFacts | null) => void) {
    return guarded(
      "request the approval",
      () =>
        db.transaction(async (tx) => {
          const facts = input.subject === "event" ? await lockEvent(tx, input.itemId) : await lockTask(tx, input.itemId);
          guard(facts);
          if (!facts) throw new NotFoundError("Item not found", ERROR_CODES.STAGE_APPROVAL_NOT_FOUND);
          const [row] = await tx
            .insert(stageApprovals)
            .values({
              ...(input.subject === "event"
                ? { eventId: input.itemId, eventStageId: facts.stageId }
                : { taskId: input.itemId, taskStageId: facts.stageId }),
              requestNote: input.note,
              requestLink: input.link,
              requestedBy: input.requestedBy,
            })
            .returning({ id: stageApprovals.id });
          return row!.id;
        }),
      (err) => (isOnePendingViolation(err) ? new ConflictError("A request for this stage is already waiting", ERROR_CODES.STAGE_APPROVAL_PENDING) : undefined),
    );
  }

  findRow(id: string) {
    return guarded("load the approval", async (): Promise<ApprovalRow | null> => {
      const [row] = await selectRows(db, eq(stageApprovals.id, id), [], 1, 0);
      return row ? toApprovalRow(row) : null;
    });
  }

  transition(id: string, pinClientId: string | null, guard: (row: ApprovalRow | null) => ApprovalWrite) {
    return guarded("save the decision", () =>
      db.transaction(async (tx) => {
        const where = pinClientId === null ? eq(stageApprovals.id, id) : and(eq(stageApprovals.id, id), eq(events.clientId, pinClientId));
        const [found] = await selectRows(tx, where, [], 1, 0, true);
        const write = guard(found ? toApprovalRow(found) : null);
        await tx
          .update(stageApprovals)
          .set({
            status: write.status,
            decidedBy: write.decidedBy,
            decidedVia: write.decidedVia,
            decisionComment: write.comment,
            ...(write.stampTime ? { decidedAt: sql`now()` } : {}),
            version: sql`${stageApprovals.version} + 1`,
          })
          // The status check is belt and braces: the guard already refused anything but a pending row.
          .where(and(eq(stageApprovals.id, id), eq(stageApprovals.status, "pending")));
      }),
    );
  }

  list(userId: string, role: string, filters: ApprovalListFilters, limit: number, offset: number) {
    return guarded("load approvals", () => listApprovalRows(db, userId, role, filters, limit, offset));
  }

  count(userId: string, role: string, filters: ApprovalListFilters) {
    return guarded("count approvals", () => countApprovalRows(db, userId, role, filters));
  }

  deciderIds(approvalId: string) {
    return guarded("find the approvers", () => selectDeciderIds(db, approvalId));
  }

  eventNotifiedTeam(eventId: string) {
    return guarded("load the event's team", async () => {
      // The join makes Drizzle qualify the column: unqualified, `client_id` would bind to the subquery's own client_members.
      const [row] = await db
        .select({ ids: notifiedTeamIdsOf(clients.id) })
        .from(events)
        .innerJoin(clients, eq(clients.id, events.clientId))
        .where(eq(events.id, eventId))
        .limit(1);
      return row?.ids ?? [];
    });
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The stage's approvals that matter to a new request: an approved one, a pending one. One query. */
async function stageState(tx: Tx, subject: "event" | "task", stageId: string): Promise<{ approved: boolean; pending: boolean }> {
  const column = subject === "event" ? stageApprovals.eventStageId : stageApprovals.taskStageId;
  const rows = await tx
    .selectDistinct({ status: stageApprovals.status })
    .from(stageApprovals)
    .where(and(eq(column, stageId), inArray(stageApprovals.status, ["approved", "pending"])));
  return { approved: rows.some((r) => r.status === "approved"), pending: rows.some((r) => r.status === "pending") };
}

/** Locks the event row and reads what the request rules need (null if it doesn't exist). */
async function lockEvent(tx: Tx, id: string): Promise<ApprovalItemFacts | null> {
  const [row] = await tx
    .select({
      title: events.title,
      state: events.state,
      clientId: events.clientId,
      clientStatus: clients.status,
      teamIds: teamIdsOf(clients.id),
      stageId: eventStages.id,
      stageName: eventStages.name,
      stagePosition: eventStages.position,
      approvers: eventStages.approvers,
    })
    .from(events)
    .innerJoin(clients, eq(clients.id, events.clientId))
    .innerJoin(eventStages, eq(eventStages.id, events.currentStageId))
    .where(eq(events.id, id))
    .for("update", { of: events });
  if (!row) return null;
  return {
    subject: "event",
    itemId: id,
    title: row.title,
    clientId: row.clientId,
    clientArchived: row.clientStatus === "archived",
    teamIds: row.teamIds,
    assigneeId: null,
    assignedBy: null,
    inactive: row.state === "active" ? null : "event_not_active",
    stageId: row.stageId,
    stageName: row.stageName,
    stagePosition: row.stagePosition,
    approvers: row.approvers,
    ...(await stageState(tx, "event", row.stageId)),
  };
}

/** Locks the task row and reads what the request rules need (null if it doesn't exist). */
async function lockTask(tx: Tx, id: string): Promise<ApprovalItemFacts | null> {
  const [row] = await tx
    .select({
      title: staffTasks.title,
      status: staffTasks.status,
      assigneeId: staffTasks.assigneeId,
      assignedBy: staffTasks.assignedBy,
      clientId: staffTasks.clientId,
      clientStatus: clients.status,
      teamIds: teamIdsOf(staffTasks.clientId),
      stageId: taskStages.id,
      stageName: taskStages.name,
      stagePosition: taskStages.position,
      approvers: taskStages.approvers,
    })
    .from(staffTasks)
    .leftJoin(clients, eq(clients.id, staffTasks.clientId))
    .innerJoin(taskStages, eq(taskStages.id, staffTasks.currentStageId))
    .where(eq(staffTasks.id, id))
    .for("update", { of: staffTasks });
  if (!row) return null;
  return {
    subject: "task",
    itemId: id,
    title: row.title,
    clientId: row.clientId,
    clientArchived: row.clientStatus === "archived",
    teamIds: row.teamIds,
    assigneeId: row.assigneeId,
    assignedBy: row.assignedBy,
    inactive: row.status === "done" ? "task_done" : null,
    stageId: row.stageId,
    stageName: row.stageName,
    stagePosition: row.stagePosition,
    approvers: row.approvers,
    ...(await stageState(tx, "task", row.stageId)),
  };
}
