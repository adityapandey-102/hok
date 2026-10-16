import {
  NOTIFICATION_BODY_MAX,
  NOTIFICATION_TITLE_MAX,
  NOTIFICATION_URL_MAX,
  NO_MUTES,
  type NormalizedPayload,
  type NotificationPayload,
  type NotificationPreferences,
  type NotificationRequest,
  type PushMessage,
} from "./notification.entity";

/** Where a notification opens when its target is unknown or unsafe. */
export const FALLBACK_URL = "/app";

/**
 * An app path only: starts with one "/" (not "//", which a browser reads as
 * another host), no backslashes or control characters. A push click must
 * never open another site (hok-web's sw.js checks the origin again).
 */
export function isAppPath(url: string): boolean {
  return /^\/(?![/\\])[^\s\\]*$/.test(url) && url.length <= NOTIFICATION_URL_MAX;
}

function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Makes a caller's payload safe to store and show: titles and bodies trimmed
 * and capped, an unsafe url replaced by the app home, `data` kept to short
 * string values. Callers are other modules (not users), so this repairs
 * rather than throws: a notification is never worth failing the change it
 * reports.
 */
export function normalizePayload(payload: NotificationPayload): NormalizedPayload {
  const title = clip(payload.title || "HOK", NOTIFICATION_TITLE_MAX) || "HOK";
  const body = payload.body ? clip(payload.body, NOTIFICATION_BODY_MAX) : null;
  const url = payload.url && isAppPath(payload.url) ? payload.url : FALLBACK_URL;
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload.data ?? {}).slice(0, 10)) {
    if (/^[a-zA-Z][a-zA-Z0-9]{0,39}$/.test(key) && typeof value === "string") data[key] = value.slice(0, 100);
  }
  return { title, body: body || null, url, data };
}

export interface DeliveryPlan {
  /** Get a row in the bell. */
  inApp: string[];
  /** Also get a push on their devices (always a subset of inApp). */
  push: string[];
}

/**
 * Who gets what (FR-NTF-03/04): each recipient once, never the actor (no
 * notification about your own action), then each person's mutes for this
 * trigger. Muting the bell mutes the push too: a push always has a bell
 * entry to land on.
 */
export function planDelivery(
  request: Pick<NotificationRequest, "type" | "recipientIds" | "actorId">,
  preferencesOf: (userId: string) => NotificationPreferences = () => NO_MUTES,
): DeliveryPlan {
  const recipients = [...new Set(request.recipientIds)].filter((id) => id && id !== request.actorId);
  const inApp = recipients.filter((id) => !preferencesOf(id).mutedInApp.includes(request.type));
  const push = inApp.filter((id) => !preferencesOf(id).mutedPush.includes(request.type));
  return { inApp, push };
}

/** The push the service worker shows. Same type + target = same tag, so a repeat replaces the older one. */
export function toPushMessage(type: string, payload: NotificationPayload): PushMessage {
  const safe = normalizePayload(payload);
  return { title: safe.title, body: safe.body ?? "", url: safe.url, tag: `${type}:${safe.url}` };
}

/**
 * A preferences update: keeps only known, live triggers (an unknown or
 * future one is ignored, never stored), de-duplicated and sorted so the
 * stored arrays are stable.
 */
export function sanitizeMutes(types: readonly string[], allowed: readonly string[]): string[] {
  return [...new Set(types.filter((t) => allowed.includes(t)))].sort();
}
