import { planDelivery, normalizePayload } from "../domain/notification.rules";
import { NO_MUTES, type NotificationRequest } from "../domain/notification.entity";
import { insertNotificationRows, selectPreferences, type DbExecutor } from "./drizzle-notifications.repository";

/**
 * Writes the bell rows for `request` on the caller's executor -- inside the
 * caller's own transaction, so the notification commits (or rolls back) with
 * the change it reports (ARCHITECTURE §8). Applies the recipients' in-app
 * mutes and skips the actor, exactly like `notifier.notify`. Two queries
 * (preferences, insert); none when nobody is left to notify.
 *
 * For another module's Infrastructure layer (its repository, inside its
 * `db.transaction`); after the commit, its Application layer calls
 * `notifier.push(request)` for the web push. Unlike `notify`, this throws:
 * inside a transaction a failure must roll the change back like any other
 * write, never half-commit it.
 */
export async function insertNotificationsInTransaction(tx: DbExecutor, request: NotificationRequest): Promise<void> {
  const candidates = [...new Set(request.recipientIds)].filter((id) => id !== request.actorId);
  if (candidates.length === 0) return;
  const prefs = await selectPreferences(tx, candidates);
  const { inApp } = planDelivery(request, (id) => prefs.get(id) ?? NO_MUTES);
  if (inApp.length === 0) return;
  const payload = normalizePayload(request.payload);
  await insertNotificationRows(
    tx,
    inApp.map((userId) => ({ userId, type: request.type, actorId: request.actorId, payload })),
  );
}
