import { and, asc, desc, eq, getTableColumns, inArray, isNull, notInArray, sql, type SQL } from "drizzle-orm";
import { db } from "../../../common/database/drizzle-client";
// Cross-module Infrastructure-only read: `profiles` is owned by the Users
// module's schema (the actor's name on a bell entry). See docs/adr/0003.
import { profiles } from "../../users/infrastructure/profile.schema";
import { notificationPreferences, notifications, pushSubscriptions } from "./notifications.schema";
import type { NotificationEntity, NotificationPreferences, PushSubscriptionEntity } from "../domain/notification.entity";
import { MAX_PUSH_DEVICES, REMINDER_TYPES } from "../domain/notification.entity";
import type {
  NewNotificationRecord,
  NewPushSubscription,
  NotificationListPage,
  NotificationsRepositoryPort,
} from "../application/ports/notifications-repository.port";
import { guarded } from "../../../common/database/guarded";

/** The pool, or an open transaction (for insertNotificationsInTransaction). */
export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];


const NOTIFICATION_SELECT = {
  id: notifications.id,
  userId: notifications.userId,
  type: notifications.type,
  actorId: notifications.actorId,
  actorName: profiles.fullName,
  payload: notifications.payload,
  readAt: notifications.readAt,
  createdAt: notifications.createdAt,
};

type NotificationRow = {
  id: string;
  userId: string;
  type: string;
  actorId: string | null;
  actorName: string | null;
  payload: { title: string; body: string | null; url: string | null; data?: Record<string, string> };
  readAt: Date | null;
  createdAt: Date;
};

function toEntity(row: NotificationRow): NotificationEntity {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    actorId: row.actorId,
    actorName: row.actorName,
    title: row.payload.title,
    body: row.payload.body ?? null,
    url: row.payload.url ?? null,
    data: row.payload.data ?? {},
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toRowValues(records: NewNotificationRecord[]) {
  return records.map((r) => ({ userId: r.userId, type: r.type, actorId: r.actorId, payload: r.payload }));
}

/**
 * Preferences of the ACTIVE accounts among `userIds` -- the one place delivery
 * recipients are resolved, so a deactivated account gets no bell row or push
 * of any type. Every active user is present (no preferences row = no mutes);
 * inactive or unknown ids are absent, and callers drop them.
 */
export async function selectPreferences(ex: DbExecutor, userIds: string[]): Promise<Map<string, NotificationPreferences>> {
  const result = new Map<string, NotificationPreferences>();
  if (userIds.length === 0) return result;
  const rows = await ex
    .select({ userId: profiles.id, mutedPush: notificationPreferences.mutedPush, mutedInApp: notificationPreferences.mutedInApp })
    .from(profiles)
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, profiles.id))
    .where(and(inArray(profiles.id, userIds), eq(profiles.active, true)));
  for (const r of rows) result.set(r.userId, { mutedPush: r.mutedPush ?? [], mutedInApp: r.mutedInApp ?? [] });
  return result;
}

export async function insertNotificationRows(ex: DbExecutor, records: NewNotificationRecord[]): Promise<void> {
  if (records.length > 0) await ex.insert(notifications).values(toRowValues(records));
}

/**
 * Persistence for notifications through Drizzle. Scale: ~20-50 staff, each
 * with a bell polled about once a minute -- the unread count is one
 * index-only count (partial index on unread rows); a page is one query with
 * the actor's name joined, plus one count.
 */
export class DrizzleNotificationsRepository implements NotificationsRepositoryPort {
  private listConditions(userId: string, unreadOnly: boolean): SQL | undefined {
    return unreadOnly ? and(eq(notifications.userId, userId), isNull(notifications.readAt)) : eq(notifications.userId, userId);
  }

  findForUser(userId: string, unreadOnly: boolean, page: NotificationListPage) {
    return guarded("load notifications", async () => {
      const rows = await db
        .select(NOTIFICATION_SELECT)
        .from(notifications)
        .leftJoin(profiles, eq(profiles.id, notifications.actorId))
        .where(this.listConditions(userId, unreadOnly))
        // Newest first; id breaks ties so pages stay stable.
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(page.limit)
        .offset(page.offset);
      return (rows as NotificationRow[]).map(toEntity);
    });
  }

  countForUser(userId: string, unreadOnly: boolean) {
    return guarded("count notifications", async () => {
      const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(this.listConditions(userId, unreadOnly));
      return row?.count ?? 0;
    });
  }

  countUnread(userId: string) {
    return guarded("count unread notifications", async () => {
      // One pass over the user's unread rows (partial index notifications_user_unread_idx).
      const [row] = await db
        .select({
          count: sql<number>`count(*)::int`,
          reminders: sql<number>`(count(*) filter (where ${inArray(notifications.type, [...REMINDER_TYPES])}))::int`,
        })
        .from(notifications)
        .where(this.listConditions(userId, true));
      return { count: row?.count ?? 0, reminders: row?.reminders ?? 0 };
    });
  }

  markRead(userId: string, id: string) {
    return guarded("mark the notification read", async () => {
      const rows = await db
        .update(notifications)
        // Already read keeps its first read time.
        .set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
        .returning({ id: notifications.id });
      return rows.length > 0;
    });
  }

  markAllRead(userId: string) {
    return guarded("mark notifications read", async () => {
      const rows = await db
        .update(notifications)
        .set({ readAt: sql`now()` })
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
        .returning({ id: notifications.id });
      return rows.length;
    });
  }

  insertMany(records: NewNotificationRecord[]) {
    return guarded("record notifications", () => insertNotificationRows(db, records));
  }

  findPreferences(userIds: string[]) {
    return guarded("load notification preferences", () => selectPreferences(db, userIds));
  }

  savePreferences(userId: string, preferences: NotificationPreferences) {
    return guarded("save notification preferences", async () => {
      await db
        .insert(notificationPreferences)
        .values({ userId, mutedPush: preferences.mutedPush, mutedInApp: preferences.mutedInApp })
        .onConflictDoUpdate({
          target: notificationPreferences.userId,
          set: { mutedPush: preferences.mutedPush, mutedInApp: preferences.mutedInApp },
        });
      return preferences;
    });
  }

  /** Saves this browser, then keeps only the user's MAX_PUSH_DEVICES most recently used devices (the oldest drops off). */
  saveSubscription(s: NewPushSubscription) {
    return guarded("save the push subscription", () => db.transaction(async (tx) => {
      // Serialises one user's concurrent subscribes so the cap can't be overshot.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${s.userId}))`);
      await tx
        .insert(pushSubscriptions)
        .values({ userId: s.userId, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, userAgent: s.userAgent })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          // Same browser: fresh keys, and it now belongs to whoever subscribed last.
          set: { userId: s.userId, p256dh: s.p256dh, auth: s.auth, userAgent: s.userAgent, lastUsedAt: sql`now()` },
        });
      const keep = tx
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, s.userId))
        .orderBy(desc(pushSubscriptions.lastUsedAt), desc(pushSubscriptions.createdAt))
        .limit(MAX_PUSH_DEVICES);
      await tx.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, s.userId), notInArray(pushSubscriptions.id, keep)));
    }));
  }

  findSubscriptionsForUsers(userIds: string[]) {
    return guarded("load push devices", async (): Promise<PushSubscriptionEntity[]> => {
      if (userIds.length === 0) return [];
      // Active owners only: a deactivated account's devices stay silent even if one slipped in.
      const rows = await db
        .select(getTableColumns(pushSubscriptions))
        .from(pushSubscriptions)
        .innerJoin(profiles, eq(profiles.id, pushSubscriptions.userId))
        .where(and(inArray(pushSubscriptions.userId, userIds), eq(profiles.active, true)))
        .orderBy(asc(pushSubscriptions.createdAt));
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), lastUsedAt: r.lastUsedAt.toISOString() }));
    });
  }

  deleteSubscription(userId: string, id: string) {
    return guarded("remove the push device", async () => {
      const rows = await db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.id, id), eq(pushSubscriptions.userId, userId)))
        .returning({ id: pushSubscriptions.id });
      return rows.length > 0;
    });
  }

  deleteSubscriptionByEndpoint(userId: string, endpoint: string) {
    return guarded("unsubscribe the push device", async () => {
      const rows = await db
        .delete(pushSubscriptions)
        .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)))
        .returning({ id: pushSubscriptions.id });
      return rows.length > 0;
    });
  }

  deleteSubscriptionsByIds(ids: string[]) {
    return guarded("remove dead push devices", async () => {
      if (ids.length > 0) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, ids));
    });
  }

  touchSubscriptions(ids: string[]) {
    return guarded("update push devices", async () => {
      if (ids.length > 0) await db.update(pushSubscriptions).set({ lastUsedAt: sql`now()` }).where(inArray(pushSubscriptions.id, ids));
    });
  }
}
