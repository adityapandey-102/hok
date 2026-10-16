import { logger } from "../../../common/logger/logger";
import { planDelivery, normalizePayload, toPushMessage } from "../domain/notification.rules";
import { NO_MUTES, type NotificationRequest, type PushMessage } from "../domain/notification.entity";
import type { NotificationsRepositoryPort } from "./ports/notifications-repository.port";
import type { PushSender } from "./ports/push-sender.port";

export interface PushReport {
  sent: number;
  failed: number;
  /** Dead subscriptions (404/410) deleted on the way. */
  removed: number;
}

/**
 * The hook every module calls to notify people (ARCHITECTURE §8). Two entry
 * points, both called AFTER the triggering change has committed, both
 * best-effort -- they log and swallow every error, so a notification problem
 * can never fail or roll back the change it reports:
 *
 * - `notify(request)`: writes the bell rows, then sends web push. For callers
 *   whose change is already committed (e.g. Staff tasks, client comments).
 * - `push(request)`: web push only, for callers that wrote the bell rows in
 *   their own transaction with `insertNotificationsInTransaction` (e.g. a
 *   client reassignment), so the bell and the change commit together.
 *
 * Both apply each recipient's preferences and never notify the actor.
 * Pushes go out in the background (the API answers without waiting for push
 * services); `flush()` waits for them (tests, shutdown). Dead subscriptions
 * (404/410) are deleted; successful ones get last_used_at.
 */
export class NotificationDispatcher {
  private readonly pending = new Set<Promise<unknown>>();

  constructor(
    private readonly repo: NotificationsRepositoryPort,
    private readonly sender: PushSender,
  ) {}

  async notify(request: NotificationRequest): Promise<void> {
    try {
      const candidates = [...new Set(request.recipientIds)].filter((id) => id !== request.actorId);
      if (candidates.length === 0) return;
      const prefs = await this.repo.findPreferences(candidates);
      const plan = planDelivery(request, (id) => prefs.get(id) ?? NO_MUTES);
      if (plan.inApp.length === 0) return;
      const payload = normalizePayload(request.payload);
      await this.repo.insertMany(plan.inApp.map((userId) => ({ userId, type: request.type, actorId: request.actorId, payload })));
      if (plan.push.length > 0) this.background(this.deliver(plan.push, toPushMessage(request.type, request.payload)));
    } catch (error) {
      logger.error({ err: error, type: request.type }, "Could not record notifications; the change itself is unaffected");
    }
  }

  async push(request: NotificationRequest): Promise<void> {
    if (!this.sender.enabled) return;
    try {
      const candidates = [...new Set(request.recipientIds)].filter((id) => id !== request.actorId);
      if (candidates.length === 0) return;
      const prefs = await this.repo.findPreferences(candidates);
      const plan = planDelivery(request, (id) => prefs.get(id) ?? NO_MUTES);
      if (plan.push.length > 0) this.background(this.deliver(plan.push, toPushMessage(request.type, request.payload)));
    } catch (error) {
      logger.error({ err: error, type: request.type }, "Could not send push notifications");
    }
  }

  /** Sends one message to every device of one user and waits for the result (the "Send a test" button). */
  sendToUser(userId: string, message: PushMessage): Promise<PushReport> {
    return this.deliver([userId], message);
  }

  /** Resolves once every background push started so far has finished. */
  async flush(): Promise<void> {
    while (this.pending.size > 0) await Promise.allSettled([...this.pending]);
  }

  private background(work: Promise<unknown>): void {
    const tracked = work.catch((error: unknown) => logger.error({ err: error }, "Push delivery failed"));
    this.pending.add(tracked);
    void tracked.finally(() => this.pending.delete(tracked));
  }

  private async deliver(userIds: string[], message: PushMessage): Promise<PushReport> {
    const report: PushReport = { sent: 0, failed: 0, removed: 0 };
    if (!this.sender.enabled || userIds.length === 0) return report;
    const devices = await this.repo.findSubscriptionsForUsers(userIds);
    if (devices.length === 0) return report;

    const outcomes = await Promise.all(devices.map(async (d) => ({ id: d.id, outcome: await this.sender.send(d, message).catch(() => "failed" as const) })));
    const gone = outcomes.filter((o) => o.outcome === "gone").map((o) => o.id);
    const sent = outcomes.filter((o) => o.outcome === "sent").map((o) => o.id);
    report.sent = sent.length;
    report.removed = gone.length;
    report.failed = outcomes.length - sent.length - gone.length;
    if (gone.length > 0) await this.repo.deleteSubscriptionsByIds(gone);
    if (sent.length > 0) await this.repo.touchSubscriptions(sent);
    if (report.failed > 0) logger.warn({ failed: report.failed, devices: outcomes.length }, "Some push notifications could not be delivered");
    return report;
  }
}
