/**
 * The Notifications module's public surface: what other modules (their
 * composition roots and repositories) may import. Everything else in this
 * folder is internal. Contract: README "Notifications" and docs/adr/0007.
 *
 * Raising a notification from another module:
 *
 *   1. After your change has committed (the simple path):
 *        await notifier.notify({
 *          type: "task_assigned",
 *          recipientIds: [assigneeId],
 *          actorId: caller.userId,          // never notified about their own action
 *          payload: taskAssignedPayload({ taskId, title, actorName }),
 *        });
 *      Writes the bell rows, then sends web push in the background. Never
 *      throws; failures are logged and never affect your change.
 *
 *   2. Bell row in your own transaction (ARCHITECTURE §8's ideal): in your
 *      repository, inside `db.transaction(async (tx) => ...)`, call
 *        await insertNotificationsInTransaction(tx, request);
 *      then, after the commit, `await notifier.push(request)` for the web push.
 *
 * Wire it through your own module's port (your Application layer never
 * imports this file -- docs/adr/0003): define an interface in
 * `application/ports`, and build the adapter in your `api/*.routes.ts`
 * composition root from `notifier`. Then set the trigger's `live: true` in
 * domain/notification.entity.ts so it appears in everyone's preferences.
 */
import { NotificationDispatcher } from "./application/notification-dispatcher";
import { NotificationsService } from "./application/notifications.service";
import { DrizzleNotificationsRepository } from "./infrastructure/drizzle-notifications.repository";
import { createPushSender } from "./infrastructure/web-push.sender";

const repository = new DrizzleNotificationsRepository();

/** Web push via VAPID (or disabled when the keys aren't set). */
export const pushSender = createPushSender();

/** The hook: `notify(request)` (bell + push) or `push(request)` (push only). */
export const notifier = new NotificationDispatcher(repository, pushSender);

/** The caller-facing service behind /api/v1/notifications. */
export const notificationsService = new NotificationsService(repository, notifier, pushSender);

export { insertNotificationsInTransaction } from "./infrastructure/notifications-in-transaction";
export type { NotificationDispatcher } from "./application/notification-dispatcher";
export type { NotificationPayload, NotificationRequest, NotificationType } from "./domain/notification.entity";
export {
  clientCommentPayload,
  clientReassignedPayload,
  taskAssignedPayload,
  taskCommentedPayload,
  taskStatusChangedPayload,
} from "./domain/notification.messages";
