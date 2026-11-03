import { and, eq, sql } from "drizzle-orm";
import type { db } from "../../../common/database/drizzle-client";
import { stageApprovals } from "./approvals.schema";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The two reads/writes the Events and Staff-tasks repositories make INSIDE their move transactions
 * (ADR 0003: Infrastructure-to-Infrastructure). Both run on the item's locked row, so a move, a request
 * and a back move on one item never interleave.
 */

/** The stage ids that hold an `approved` approval, for the move gate: one indexed query (event_id / task_id + status). */
export async function approvedStageIds(ex: Executor, subject: "event" | "task", itemId: string): Promise<Set<string>> {
  const rows =
    subject === "event"
      ? await ex
          .selectDistinct({ stageId: stageApprovals.eventStageId })
          .from(stageApprovals)
          .where(and(eq(stageApprovals.eventId, itemId), eq(stageApprovals.status, "approved")))
      : await ex
          .selectDistinct({ stageId: stageApprovals.taskStageId })
          .from(stageApprovals)
          .where(and(eq(stageApprovals.taskId, itemId), eq(stageApprovals.status, "approved")));
  return new Set(rows.flatMap((r) => (r.stageId ? [r.stageId] : [])));
}

export interface SupersedeOutcome {
  /** Approved rows that no longer count. */
  superseded: number;
  /** Pending requests dropped. */
  cancelled: number;
}

/**
 * A BACK move to `fromPosition` (a task reopen counts as one): every approval of the stages from there on stops
 * counting. `approved` rows become `superseded` (kept for history), `pending` ones `cancelled`. One statement.
 * Decided rows that are not approved (changes_requested, cancelled) are history already and stay as they are.
 */
export async function supersedeFrom(ex: Executor, subject: "event" | "task", itemId: string, fromPosition: number): Promise<SupersedeOutcome> {
  const result =
    subject === "event"
      ? await ex.execute(sql`
          update stage_approvals a
          set status = case when a.status = 'approved' then 'superseded' else 'cancelled' end, version = a.version + 1
          from event_stages s
          where a.event_id = ${itemId} and s.id = a.event_stage_id and s.position >= ${fromPosition}
            and a.status in ('approved', 'pending')
          returning a.status as status`)
      : await ex.execute(sql`
          update stage_approvals a
          set status = case when a.status = 'approved' then 'superseded' else 'cancelled' end, version = a.version + 1
          from task_stages s
          where a.task_id = ${itemId} and s.id = a.task_stage_id and s.position >= ${fromPosition}
            and a.status in ('approved', 'pending')
          returning a.status as status`);
  const rows = result.rows as { status: string }[];
  return { superseded: rows.filter((r) => r.status === "superseded").length, cancelled: rows.filter((r) => r.status === "cancelled").length };
}
