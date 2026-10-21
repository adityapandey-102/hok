import { REMINDER_TYPES, type NotificationEntity, type NotificationPreferences, type PushMessage, type PushSubscriptionEntity } from "../domain/notification.entity";
import type {
  NewNotificationRecord,
  NewPushSubscription,
  NotificationListPage,
  NotificationsRepositoryPort,
} from "./ports/notifications-repository.port";
import type { PushOutcome, PushSender } from "./ports/push-sender.port";

/** In-memory NotificationsRepositoryPort for unit tests (SQL is covered by the integration suite). */
export class FakeNotificationsRepository implements NotificationsRepositoryPort {
  rows: NotificationEntity[] = [];
  prefs = new Map<string, NotificationPreferences>();
  devices: PushSubscriptionEntity[] = [];
  touched: string[] = [];
  failNextInsert = false;

  private mine(userId: string, unreadOnly: boolean) {
    return this.rows.filter((r) => r.userId === userId && (!unreadOnly || r.readAt === null));
  }
  findForUser(userId: string, unreadOnly: boolean, page: NotificationListPage) {
    return Promise.resolve(this.mine(userId, unreadOnly).slice(page.offset, page.offset + page.limit));
  }
  countForUser(userId: string, unreadOnly: boolean) {
    return Promise.resolve(this.mine(userId, unreadOnly).length);
  }
  countUnread(userId: string) {
    const unread = this.rows.filter((r) => r.userId === userId && r.readAt === null);
    return Promise.resolve({ count: unread.length, reminders: unread.filter((r) => (REMINDER_TYPES as readonly string[]).includes(r.type)).length });
  }
  markRead(userId: string, id: string) {
    const row = this.rows.find((r) => r.id === id && r.userId === userId);
    if (row && !row.readAt) row.readAt = "2026-10-15T00:00:00.000Z";
    return Promise.resolve(Boolean(row));
  }
  markAllRead(userId: string) {
    const unread = this.mine(userId, true);
    for (const r of unread) r.readAt = "2026-10-15T00:00:00.000Z";
    return Promise.resolve(unread.length);
  }
  insertMany(records: NewNotificationRecord[]) {
    if (this.failNextInsert) {
      this.failNextInsert = false;
      return Promise.reject(new Error("db down"));
    }
    for (const r of records) {
      this.rows.unshift({
        id: `n${this.rows.length + 1}`,
        userId: r.userId,
        type: r.type,
        actorId: r.actorId,
        actorName: r.actorId,
        title: r.payload.title,
        body: r.payload.body,
        url: r.payload.url,
        data: r.payload.data,
        readAt: null,
        createdAt: "2026-10-15T00:00:00.000Z",
      });
    }
    return Promise.resolve();
  }
  findPreferences(userIds: string[]) {
    return Promise.resolve(new Map([...this.prefs].filter(([id]) => userIds.includes(id))));
  }
  savePreferences(userId: string, preferences: NotificationPreferences) {
    this.prefs.set(userId, preferences);
    return Promise.resolve(preferences);
  }
  saveSubscription(s: NewPushSubscription) {
    this.devices = this.devices.filter((d) => d.endpoint !== s.endpoint);
    this.devices.push({ ...s, id: `d${this.devices.length + 1}-${s.endpoint.slice(-2)}`, createdAt: "t", lastUsedAt: "t" });
    return Promise.resolve();
  }
  findSubscriptionsForUsers(userIds: string[]) {
    return Promise.resolve(this.devices.filter((d) => userIds.includes(d.userId)));
  }
  deleteSubscription(userId: string, id: string) {
    const before = this.devices.length;
    this.devices = this.devices.filter((d) => !(d.id === id && d.userId === userId));
    return Promise.resolve(this.devices.length < before);
  }
  deleteSubscriptionByEndpoint(userId: string, endpoint: string) {
    const before = this.devices.length;
    this.devices = this.devices.filter((d) => !(d.endpoint === endpoint && d.userId === userId));
    return Promise.resolve(this.devices.length < before);
  }
  deleteSubscriptionsByIds(ids: string[]) {
    this.devices = this.devices.filter((d) => !ids.includes(d.id));
    return Promise.resolve();
  }
  touchSubscriptions(ids: string[]) {
    this.touched.push(...ids);
    return Promise.resolve();
  }
}

/** Records every push; an endpoint ending in "gone" answers 410, one ending in "fail" errors. */
export class FakePushSender implements PushSender {
  sent: { endpoint: string; message: PushMessage }[] = [];
  constructor(
    readonly enabled = true,
    readonly publicKey: string | null = enabled ? "BPublicKey" : null,
  ) {}
  send(subscription: { endpoint: string }, message: PushMessage): Promise<PushOutcome> {
    if (subscription.endpoint.endsWith("gone")) return Promise.resolve("gone");
    if (subscription.endpoint.endsWith("fail")) return Promise.resolve("failed");
    this.sent.push({ endpoint: subscription.endpoint, message });
    return Promise.resolve("sent");
  }
}

export function device(userId: string, endpoint: string): NewPushSubscription {
  return { userId, endpoint, p256dh: "p", auth: "a", userAgent: null };
}
