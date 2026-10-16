import type { NormalizedPayload, NotificationEntity, NotificationPreferences, PushSubscriptionEntity } from "../../domain/notification.entity";

export interface NotificationListPage {
  limit: number;
  offset: number;
}

/** One bell row to write. */
export interface NewNotificationRecord {
  userId: string;
  type: string;
  actorId: string | null;
  payload: NormalizedPayload;
}

export interface NewPushSubscription {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}

/** Persistence contract for the Notifications module -- data access only, no business rules. */
export interface NotificationsRepositoryPort {
  // -- the bell (always the caller's own rows) ---------------------------------
  findForUser(userId: string, unreadOnly: boolean, page: NotificationListPage): Promise<NotificationEntity[]>;
  countForUser(userId: string, unreadOnly: boolean): Promise<number>;
  /** The badge: an index-only count of unread rows. */
  countUnread(userId: string): Promise<number>;
  /** Marks one of the user's notifications read. False if no such row is theirs. Already read = true, unchanged. */
  markRead(userId: string, id: string): Promise<boolean>;
  /** Marks all the user's unread notifications read; returns how many changed. */
  markAllRead(userId: string): Promise<number>;
  /** Writes bell rows (one statement). */
  insertMany(records: NewNotificationRecord[]): Promise<void>;

  // -- preferences ---------------------------------------------------------------
  /** Preferences of these users (one query); users with no row are absent. */
  findPreferences(userIds: string[]): Promise<Map<string, NotificationPreferences>>;
  savePreferences(userId: string, preferences: NotificationPreferences): Promise<NotificationPreferences>;

  // -- push devices ----------------------------------------------------------------
  /** Upsert by endpoint: a re-subscribe refreshes keys; the same browser signed in as someone else moves to them. */
  saveSubscription(subscription: NewPushSubscription): Promise<void>;
  findSubscriptionsForUsers(userIds: string[]): Promise<PushSubscriptionEntity[]>;
  /** Removes one of the user's devices; false if it isn't theirs. */
  deleteSubscription(userId: string, id: string): Promise<boolean>;
  /** Removes the user's device with this endpoint (unsubscribe from that browser); false if none. */
  deleteSubscriptionByEndpoint(userId: string, endpoint: string): Promise<boolean>;
  /** Dead endpoints (404/410 from the push service). */
  deleteSubscriptionsByIds(ids: string[]): Promise<void>;
  /** Stamps last_used_at after a successful send. */
  touchSubscriptions(ids: string[]): Promise<void>;
}
