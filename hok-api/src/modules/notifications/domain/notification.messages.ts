import type { NotificationPayload } from "./notification.entity";

/**
 * The words of each notification, in one place so every trigger reads the
 * same way on the bell and on a phone's lock screen. Callers pass the facts;
 * these return the payload for NotificationRequest. URLs are hok-web routes.
 *
 * Note for the module that owns a trigger: keep the wording plain and short
 * (title <= 120, body <= 300 characters; longer text is cut).
 */

/** client_reassigned -> the new owner (FR-CLI-05). */
export function clientReassignedPayload(input: { clientId: string; clientName: string; actorName?: string | null }): NotificationPayload {
  return {
    title: `${input.clientName} is now your client`,
    body: input.actorName ? `${input.actorName} assigned this client to you.` : "This client was assigned to you.",
    url: `/app/clients/${input.clientId}`,
    data: { clientId: input.clientId },
  };
}

/** task_assigned -> the assignee (M7, FR-TSK-07). */
export function taskAssignedPayload(input: { taskId: string; title: string; actorName?: string | null }): NotificationPayload {
  return {
    title: `New task: ${input.title}`,
    body: input.actorName ? `${input.actorName} assigned you a task.` : "You have a new task.",
    url: `/app/tasks/${input.taskId}`,
    data: { taskId: input.taskId },
  };
}

/**
 * task_status_changed -> the other side of the task: a stage move, completion, block, unblock or
 * reopen (round 2). The bell shows who did it ("by Priya"), so the words here are the action itself:
 * "Moved X to Rough cut", "Completed X", "Blocked X: waiting for footage".
 */
export function taskStatusChangedPayload(input: {
  taskId: string;
  title: string;
  action: "stage" | "completed" | "blocked" | "unblocked" | "reopened";
  stageName?: string | null;
  reason?: string | null;
  actorName?: string | null;
}): NotificationPayload {
  const stage = input.stageName ?? null;
  const by = input.actorName ? ` by ${input.actorName}` : "";
  const data: Record<string, string> = { taskId: input.taskId, action: input.action };
  if (stage) data.stageName = stage;
  if (input.reason) data.reason = input.reason;
  const url = `/app/tasks/${input.taskId}`;
  switch (input.action) {
    case "completed":
      return { title: `Completed ${input.title}`, body: `Marked complete${by}.`, url, data };
    case "blocked":
      return { title: `Blocked ${input.title}${input.reason ? `: ${input.reason}` : ""}`, body: input.reason ?? `Marked blocked${by}.`, url, data };
    case "unblocked":
      return { title: `Unblocked ${input.title}`, body: `No longer blocked${by}.`, url, data };
    case "reopened":
      return { title: `Reopened ${input.title}`, body: stage ? `Back at ${stage}${by}.` : `Reopened${by}.`, url, data };
    default:
      return { title: stage ? `Moved ${input.title} to ${stage}` : `Moved ${input.title}`, body: `Moved${stage ? ` to ${stage}` : ""}${by}.`, url, data };
  }
}

/** task_commented -> the other side of the task (M7). */
export function taskCommentedPayload(input: { taskId: string; title: string; actorName?: string | null; excerpt?: string | null }): NotificationPayload {
  return {
    title: `New comment on ${input.title}`,
    body: input.excerpt ? `${input.actorName ? `${input.actorName}: ` : ""}${input.excerpt}` : null,
    url: `/app/tasks/${input.taskId}`,
    data: { taskId: input.taskId },
  };
}

/** client_comment -> the client's owning manager only (M8, FR-PRT / FR-NTF-03). `url` is the comment's page in the staff app. */
export function clientCommentPayload(input: { clientId: string; clientName: string; commentId: string; url: string; excerpt?: string | null }): NotificationPayload {
  return {
    title: `New comment from ${input.clientName}`,
    body: input.excerpt ?? null,
    url: input.url,
    data: { clientId: input.clientId, commentId: input.commentId },
  };
}

/** "45 min", "1 h 50 min", "2 h": how long until a reminder's moment, as people say it. */
export function timeUntilWords(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "10:30 am" in a zone. */
function clockIn(at: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: zone }).format(at);
}

/** event_reminder -> the client's owner, about 2 hours before the event starts (FR-EVT-10). */
export function eventReminderPayload(input: { eventId: string; title: string; clientName: string; startsAt: Date; timeZone: string; now: Date }): NotificationPayload {
  return {
    title: `Starts in ${timeUntilWords(input.startsAt.getTime() - input.now.getTime())}: ${input.title}`,
    body: `${input.clientName} · ${clockIn(input.startsAt, input.timeZone)} (${input.timeZone.replace(/_/g, " ")})`,
    url: `/app/events/${input.eventId}`,
    data: { eventId: input.eventId },
  };
}

/** "1 day", "3 days": whole days, for reminders a day or more ahead. */
function daysWords(ms: number): string {
  const days = Math.max(1, Math.round(ms / (24 * 60 * 60_000)));
  return days === 1 ? "1 day" : `${days} days`;
}

/** task_due_reminder -> the assignee, about 2 hours before the task is due (FR-TSK-11). */
export function taskDueReminderPayload(input: { taskId: string; title: string; dueAt: Date; timeZone: string; now: Date }): NotificationPayload {
  return {
    title: `Due in ${timeUntilWords(input.dueAt.getTime() - input.now.getTime())}: ${input.title}`,
    body: `Due at ${clockIn(input.dueAt, input.timeZone)}.`,
    url: `/app/tasks/${input.taskId}`,
    data: { taskId: input.taskId },
  };
}

/**
 * todo_reminder -> the to-do's owner only (round 1). Sent at the urgency's
 * moments (1 day before, 1 hour before, at the due time), checked every 10
 * minutes, so "now" means due within the last/next few minutes; otherwise it
 * says how long is left.
 */
export function todoReminderPayload(input: { todoId: string; title: string; dueAt: Date; timeZone: string; now: Date }): NotificationPayload {
  const left = input.dueAt.getTime() - input.now.getTime();
  const when = left < 15 * 60_000 ? "now" : left >= 23 * 60 * 60_000 ? `in ${daysWords(left)}` : `in ${timeUntilWords(left)}`;
  return {
    title: `Due ${when}: ${input.title}`,
    body: `Due at ${clockIn(input.dueAt, input.timeZone)}.`,
    url: "/app/todos",
    data: { todoId: input.todoId },
  };
}

/** The staff page of an item an approval is on. */
const approvalItemUrl = (subject: "event" | "task", itemId: string) => (subject === "event" ? `/app/events/${itemId}` : `/app/tasks/${itemId}`);

/** approval_requested -> everyone who could decide it (round 3). One payload for every recipient; the bell shows who asked. */
export function approvalRequestedPayload(input: {
  subject: "event" | "task";
  itemId: string;
  itemTitle: string;
  stageName: string;
  approvalId: string;
}): NotificationPayload {
  return {
    title: `Approval needed: ${input.stageName}`,
    body: `${input.itemTitle} is waiting for your approval.`,
    url: approvalItemUrl(input.subject, input.itemId),
    data: { approvalId: input.approvalId, [input.subject === "event" ? "eventId" : "taskId"]: input.itemId },
  };
}

/** approval_decided -> the requester and the item's people: approved, or changes requested (round 3). `via: "portal"` = the client decided. */
export function approvalDecidedPayload(input: {
  subject: "event" | "task";
  itemId: string;
  itemTitle: string;
  stageName: string;
  approvalId: string;
  decision: "approve" | "changes";
  via: "staff" | "portal";
}): NotificationPayload {
  const approved = input.decision === "approve";
  const who = input.via === "portal" ? "The client" : "An approver";
  return {
    title: `${approved ? "Approved" : "Changes requested"}: ${input.stageName}`,
    body: `${who} ${approved ? "approved" : "asked for changes on"} ${input.itemTitle}.`,
    url: approvalItemUrl(input.subject, input.itemId),
    data: { approvalId: input.approvalId, decision: input.decision, [input.subject === "event" ? "eventId" : "taskId"]: input.itemId },
  };
}

/** stage_children_finished -> the parent's people: the last unfinished part under one of its stages is finished (round 4). */
export function stageChildrenFinishedPayload(input: { subject: "event" | "task"; itemId: string; itemTitle: string; stageName: string }): NotificationPayload {
  return {
    title: `Parts finished: ${input.stageName}`,
    body: `${input.itemTitle} can move on from "${input.stageName}".`,
    url: approvalItemUrl(input.subject, input.itemId),
    data: { [input.subject === "event" ? "eventId" : "taskId"]: input.itemId, stageName: input.stageName },
  };
}
