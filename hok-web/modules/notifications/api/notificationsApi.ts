import { apiFetch } from "../../../lib/api/client";

export type NotificationType =
  | "client_reassigned"
  | "task_assigned"
  | "task_status_changed"
  | "task_commented"
  | "client_comment";

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  /** A hok-web path (starts with /) to open on click. */
  url: string | null;
  data: Record<string, string>;
  actorName: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResult {
  notifications: AppNotification[];
  total: number;
  limit: number;
  offset: number;
}

export interface NotificationPreference {
  type: NotificationType;
  label: string;
  description: string;
  push: boolean;
  inApp: boolean;
}

export interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string | null;
}

/** All HTTP calls the Notifications module makes against hok-api. */
export const notificationsApi = {
  list(
    opts: { unread?: boolean; limit?: number; offset?: number } = {},
  ): Promise<NotificationListResult> {
    const q = new URLSearchParams();
    if (opts.unread) q.set("unread", "true");
    if (opts.limit !== undefined) q.set("limit", String(opts.limit));
    if (opts.offset !== undefined) q.set("offset", String(opts.offset));
    return apiFetch(`/notifications?${q.toString()}`);
  },

  /** Unread total, and how many are reminders (the bell's alert animation). */
  unreadCount(): Promise<{ count: number; reminders: number }> {
    return apiFetch("/notifications/unread-count");
  },

  markRead(id: string): Promise<null> {
    return apiFetch(`/notifications/${id}/read`, { method: "POST" });
  },

  markAllRead(): Promise<{ updated: number }> {
    return apiFetch("/notifications/read-all", { method: "POST" });
  },

  getPreferences(): Promise<{ preferences: NotificationPreference[] }> {
    return apiFetch("/notifications/preferences");
  },

  updatePreferences(
    preferences: { type: NotificationType; push: boolean; inApp: boolean }[],
  ): Promise<{ preferences: NotificationPreference[] }> {
    return apiFetch("/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify({ preferences }),
    });
  },

  pushConfig(): Promise<PushConfig> {
    return apiFetch("/notifications/push/config");
  },

  subscribePush(
    payload: PushSubscriptionPayload,
  ): Promise<{ subscribed: boolean }> {
    return apiFetch("/notifications/push/subscriptions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  unsubscribePush(endpoint: string): Promise<null> {
    return apiFetch("/notifications/push/subscriptions/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint }),
    });
  },
};
