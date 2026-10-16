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

/** task_status_changed -> the other side of the task (M7). `to` is the new status's label, e.g. "In progress". */
export function taskStatusChangedPayload(input: { taskId: string; title: string; to: string; actorName?: string | null }): NotificationPayload {
  return {
    title: `${input.title}: ${input.to}`,
    body: input.actorName ? `${input.actorName} moved this task to ${input.to}.` : `This task moved to ${input.to}.`,
    url: `/app/tasks/${input.taskId}`,
    data: { taskId: input.taskId },
  };
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
