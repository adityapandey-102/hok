/**
 * Pure domain shapes for notifications (REQUIREMENTS §5.10, FR-NTF-01..04;
 * ARCHITECTURE §8): the in-app bell, web push, and per-trigger preferences.
 * Instants are ISO strings (UTC).
 */

/**
 * Every trigger (FR-NTF-03). The database column is an open vocabulary, so a
 * new trigger is added here (and to NOTIFICATION_TYPE_INFO) with no migration.
 */
export const NOTIFICATION_TYPES = [
  "client_reassigned",
  "task_assigned",
  "task_status_changed",
  "task_commented",
  "client_comment",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationTypeInfo {
  /** Shown in My profile -> Notifications. */
  label: string;
  description: string;
  /**
   * True once the module that raises it calls the notifier. Preferences list
   * only live triggers (needleye's rule: no settings for things that never
   * happen). The module that wires a trigger flips this in the same change.
   */
  live: boolean;
}

export const NOTIFICATION_TYPE_INFO: Record<NotificationType, NotificationTypeInfo> = {
  client_reassigned: {
    label: "Client assigned to me",
    description: "The Admin moves a client to you.",
    live: true,
  },
  task_assigned: {
    label: "Task assigned to me",
    description: "The Admin gives you a new task (or moves one to you).",
    live: true,
  },
  task_status_changed: {
    label: "Task status changed",
    description: "A task you assigned or work on moves to another status.",
    live: true,
  },
  task_commented: {
    label: "Comment on a task",
    description: "Someone comments on a task you assigned or work on.",
    live: true,
  },
  client_comment: {
    label: "New client comment",
    description: "A client posts a comment on their portal (to the client's manager).",
    live: true,
  },
};

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export const NOTIFICATION_TITLE_MAX = 120;
export const NOTIFICATION_BODY_MAX = 300;
export const NOTIFICATION_URL_MAX = 500;

/**
 * What a notification says. `url` is an app path (e.g. "/app/clients/<id>"):
 * where clicking the bell entry or the push opens. `data` carries entity ids
 * for the web (never personal data or secrets).
 */
export interface NotificationPayload {
  title: string;
  body?: string | null;
  url?: string | null;
  data?: Record<string, string>;
}

/** A payload after normalizePayload: safe to store and show. */
export interface NormalizedPayload {
  title: string;
  body: string | null;
  url: string;
  data: Record<string, string>;
}

/**
 * The one way any module asks for notifications (the hook contract): who,
 * which trigger, who caused it (never notified about their own action), and
 * what it says. One payload for every recipient.
 */
export interface NotificationRequest {
  type: NotificationType;
  recipientIds: readonly string[];
  /** The person whose action caused it; skipped as a recipient. Null for system notifications. */
  actorId: string | null;
  payload: NotificationPayload;
}

/** One stored notification, as the bell lists it. */
export interface NotificationEntity {
  id: string;
  userId: string;
  type: string;
  actorId: string | null;
  /** Joined for display ("by Priya"); null for system notifications or a removed actor. */
  actorName: string | null;
  title: string;
  body: string | null;
  url: string | null;
  data: Record<string, string>;
  readAt: string | null;
  createdAt: string;
}

/** A user's muted triggers. No stored row = nothing muted. */
export interface NotificationPreferences {
  mutedPush: string[];
  mutedInApp: string[];
}

export const NO_MUTES: NotificationPreferences = { mutedPush: [], mutedInApp: [] };

/** A browser that allowed push (one per device). */
export interface PushSubscriptionEntity {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
}

/** What the service worker receives (public/sw.js in hok-web reads exactly these keys). */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  /** Same tag = the newer notification replaces the older one on the device. */
  tag: string;
}
