import { and, eq } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { logger } from "../../../common/logger/logger";
import type { ParentRef, WorkKind, WorkTreeNotifier } from "../../../domain";
import { clients } from "../../clients/infrastructure/clients.schema";
import { notifiedTeamIdsOf } from "../../clients/infrastructure/client-team.sql";
import { eventStages, events } from "../../events/infrastructure/events.schema";
import { staffTasks, taskStages } from "../../staff-tasks/infrastructure/staff-tasks.schema";
import type { NotificationRequest } from "../../notifications/notifications.module";
import { stageChildrenFinishedPayload } from "../../notifications/notifications.module";
import { childParentRef, openChildCounts } from "./work-tree-gate";

/** The slice of the notifications hook this needs (bell + web push; the dispatcher skips the actor and applies mutes). */
export type SendNotification = (request: NotificationRequest) => Promise<unknown>;

/** Who to tell, and what about, once a parent's stage is clear. */
interface ClearedStage {
  title: string;
  stageName: string;
  recipientIds: string[];
}

/**
 * `stage_children_finished` (round 4): when a child finishes (a task done, an event on its last stage or
 * approved there, a child event cancelled, a child task deleted), check whether its parent's stage has no
 * unfinished child left; if so, tell the parent's movers -- an event's notified team, a task's assignee and creator.
 *
 * Runs AFTER the child's change committed and is best-effort: it never throws. Two children finishing at the
 * same moment can each see the stage clear, so the people may be told twice but never zero times ("at least once").
 * A parent that can no longer move (a cancelled/postponed event, a done task) is not worth a notification.
 */
export class DrizzleWorkTreeNotifier implements WorkTreeNotifier {
  constructor(private readonly send: SendNotification) {}

  async stageMayBeClear(parent: ParentRef, actorId: string | null): Promise<void> {
    try {
      // 1 grouped read on the partial index for this one stage; any open child (any kind, visible or not) ends it here.
      const open = (await openChildCounts(db, parent.kind, parent.id, parent.stageId)).get(parent.stageId) ?? 0;
      if (open > 0) return;
      const cleared = await this.readParent(parent);
      if (!cleared || cleared.recipientIds.length === 0) return;
      await this.send({
        type: "stage_children_finished",
        recipientIds: cleared.recipientIds,
        actorId,
        payload: stageChildrenFinishedPayload({ subject: parent.kind, itemId: parent.id, itemTitle: cleared.title, stageName: cleared.stageName }),
      });
    } catch (err) {
      logger.warn({ err, parent }, "Could not check whether a parent's stage is clear; the child's change is unaffected");
    }
  }

  async childChanged(kind: WorkKind, childId: string, actorId: string | null): Promise<void> {
    try {
      const parent = await childParentRef(db, kind, childId);
      if (parent) await this.stageMayBeClear(parent, actorId);
    } catch (err) {
      logger.warn({ err, kind, childId }, "Could not look up a child's parent; the child's change is unaffected");
    }
  }

  /** The parent's title, the stage's name and the people to tell; null if the parent or stage is gone or can't move. One query. */
  private async readParent(parent: ParentRef): Promise<ClearedStage | null> {
    if (parent.kind === "event") {
      const [row] = await db
        .select({ title: events.title, state: events.state, stageName: eventStages.name, team: notifiedTeamIdsOf(clients.id) })
        .from(events)
        .innerJoin(clients, eq(clients.id, events.clientId))
        .innerJoin(eventStages, eq(eventStages.eventId, events.id))
        .where(and(eq(events.id, parent.id), eq(eventStages.id, parent.stageId)))
        .limit(1);
      if (!row || row.state !== "active") return null;
      return { title: row.title, stageName: row.stageName, recipientIds: row.team };
    }
    const [row] = await db
      .select({ title: staffTasks.title, status: staffTasks.status, stageName: taskStages.name, assigneeId: staffTasks.assigneeId, assignedBy: staffTasks.assignedBy })
      .from(staffTasks)
      .innerJoin(taskStages, eq(taskStages.taskId, staffTasks.id))
      .where(and(eq(staffTasks.id, parent.id), eq(taskStages.id, parent.stageId)))
      .limit(1);
    if (!row || row.status === "done") return null;
    return { title: row.title, stageName: row.stageName, recipientIds: [...new Set([row.assigneeId, row.assignedBy].filter((p): p is string => typeof p === "string"))] };
  }
}
