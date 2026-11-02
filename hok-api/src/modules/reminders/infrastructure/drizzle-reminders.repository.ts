import { sql } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
import { notifiedTeamIdsOf } from "../../clients/infrastructure/client-team.sql";
// Cross-module, Infrastructure-to-Infrastructure (docs/adr/0003): the
// reminder claim writes the bell rows in its own transaction.
import { eventReminderPayload, insertNotificationsInTransaction, taskDueReminderPayload, todoReminderPayload } from "../../notifications/notifications.module";
// Pure to-do reminder rules (the next moment, how late is too late).
import { TODO_REMINDER_GRACE_MS, nextTodoReminder } from "../../todos/domain/todo.rules";
import type { TodoUrgency } from "../../todos/domain/todo.entity";
import type { ReminderPush, RemindersRepositoryPort } from "../application/ports/reminders.port";

interface EventRow extends Record<string, unknown> {
  id: string;
  title: string;
  starts_at: string | Date;
  time_zone: string;
  business_name: string;
  /** Everyone on the client's team (client teams, 2026-10-23): they're all reminded. */
  team_ids: string[];
}

interface TaskRow extends Record<string, unknown> {
  id: string;
  title: string;
  due_at: string | Date;
  assignee_id: string;
  time_zone: string;
}

interface TodoRow extends Record<string, unknown> {
  id: string;
  title: string;
  due_at: string | Date | null;
  urgency: TodoUrgency;
  next_remind_at: string | Date;
  owner_id: string;
  active: boolean;
  time_zone: string;
}

const asDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));

/**
 * The reminder claim. Each kind is ONE statement: pick the due rows through
 * the partial "still waiting" index (events_reminder_due_idx /
 * staff_tasks_reminder_due_idx), lock them with SKIP LOCKED, stamp them and
 * return what the message needs -- then the bell rows, all in one transaction.
 *
 * To-dos are the third claim, in the same transaction, and work differently:
 * a to-do carries its own next moment (`next_remind_at`, from the partial
 * todos_remind_due_idx), so each claimed row is sent AND moved on to its next
 * moment. At most `limit` (50) rows, so the per-row updates are acceptable.
 */
export class DrizzleRemindersRepository implements RemindersRepositoryPort {
  claimDue(now: Date, window: { after: Date; until: Date }, limit: number): Promise<ReminderPush[]> {
    return db.transaction(async (tx) => {
      const events = await tx.execute<EventRow>(sql`
        with due as (
          select e.id
          from public.events e
          where e.reminded_at is null
            and e.state = 'active'
            and e.starts_at > ${window.after}
            and e.starts_at <= ${window.until}
          order by e.starts_at
          limit ${limit}
          for update skip locked
        )
        update public.events e
        set reminded_at = ${now}
        from due, public.clients c
        where e.id = due.id and c.id = e.client_id
        returning e.id, e.title, e.starts_at, e.time_zone, c.business_name,
          array_to_json(${notifiedTeamIdsOf(sql`c.id`)}) as team_ids`);

      const tasks = await tx.execute<TaskRow>(sql`
        with due as (
          select t.id
          from public.staff_tasks t
          where t.due_reminded_at is null
            and t.status <> 'done'
            and t.due_at is not null
            and t.due_at > ${window.after}
            and t.due_at <= ${window.until}
          order by t.due_at
          limit ${limit}
          for update skip locked
        )
        update public.staff_tasks t
        set due_reminded_at = ${now}
        from due, public.profiles p
        where t.id = due.id and p.id = t.assignee_id
        returning t.id, t.title, t.due_at, t.assignee_id, p.time_zone`);

      // Personal to-dos whose moment has come. A moment missed by more than the
      // grace (the API was down) is skipped silently; a deactivated owner is
      // never told. Either way the to-do moves on, so it can't be claimed again.
      const todoRows = await tx.execute<TodoRow>(sql`
        select t.id, t.title, t.due_at, t.urgency, t.next_remind_at, t.owner_id, p.active, p.time_zone
        from public.todos t
        join public.profiles p on p.id = t.owner_id
        where t.next_remind_at <= ${now} and t.done_at is null
        order by t.next_remind_at
        limit ${limit}
        for update of t skip locked`);
      const todoPushes: ReminderPush[] = [];
      for (const t of todoRows.rows) {
        const dueAt = t.due_at ? asDate(t.due_at) : null;
        const next = nextTodoReminder(dueAt, t.urgency, now);
        await tx.execute(sql`update public.todos set next_remind_at = ${next} where id = ${t.id}`);
        const fresh = now.getTime() - asDate(t.next_remind_at).getTime() <= TODO_REMINDER_GRACE_MS;
        if (dueAt && t.active && fresh) {
          todoPushes.push({
            type: "todo_reminder",
            recipientIds: [t.owner_id],
            actorId: null,
            payload: todoReminderPayload({ todoId: t.id, title: t.title, dueAt, timeZone: t.time_zone, now }),
          });
        }
      }

      const pushes: ReminderPush[] = [
        ...events.rows.map(
          (e): ReminderPush => ({
            type: "event_reminder",
            recipientIds: e.team_ids,
            actorId: null,
            payload: eventReminderPayload({ eventId: e.id, title: e.title, clientName: e.business_name, startsAt: asDate(e.starts_at), timeZone: e.time_zone, now }),
          }),
        ),
        ...tasks.rows.map(
          (t): ReminderPush => ({
            type: "task_due_reminder",
            recipientIds: [t.assignee_id],
            actorId: null,
            payload: taskDueReminderPayload({ taskId: t.id, title: t.title, dueAt: asDate(t.due_at), timeZone: t.time_zone, now }),
          }),
        ),
        ...todoPushes,
      ];
      // Bell rows (in-app mutes applied), committed with the claim.
      for (const p of pushes) await insertNotificationsInTransaction(tx, p);
      return pushes;
    });
  }
}
