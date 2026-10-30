import { z } from "zod";
import { NOTIFICATION_TYPES } from "../../domain/notification.entity";

export const NOTIFICATIONS_DEFAULT_LIMIT = 20;
/** Page-size cap (docs/engineering-practices.md section 1): an over-large limit is clamped, never honoured. */
export const NOTIFICATIONS_MAX_LIMIT = 50;

/** GET /notifications: the caller's bell, newest first. `unread=true` lists unread only. */
export const notificationQueryDtoSchema = z.object({
  unread: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce
    .number()
    .int()
    .optional()
    .transform((v) => Math.min(Math.max(v ?? NOTIFICATIONS_DEFAULT_LIMIT, 1), NOTIFICATIONS_MAX_LIMIT)),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
export type NotificationQueryDto = z.infer<typeof notificationQueryDtoSchema>;

/** PUT /notifications/preferences: one entry per trigger; `push` / `inApp` false = muted. Unknown or not-yet-live triggers are ignored. */
export const updatePreferencesDtoSchema = z.object({
  preferences: z
    .array(z.object({ type: z.enum(NOTIFICATION_TYPES), push: z.boolean(), inApp: z.boolean() }))
    .max(NOTIFICATION_TYPES.length * 2),
});
export type UpdatePreferencesDto = z.infer<typeof updatePreferencesDtoSchema>;

/** base64url, as the Push API encodes subscription keys. */
const base64url = (max: number) => z.string().min(1).max(max).regex(/^[A-Za-z0-9_-]+=*$/, "Not a push subscription key");
/**
 * The browsers' push services (Chrome / Edge-on-Android / Samsung / Opera: FCM; Firefox: Mozilla;
 * Safari: Apple; Edge on Windows: WNS). The API POSTs to this address on every notification, so any
 * other host would let a signed-in user point the server at an internal address (SSRF).
 */
const PUSH_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com", "notify.windows.com"];
export function isPushServiceUrl(value: string): boolean {
  try {
    const { protocol, hostname } = new URL(value);
    return protocol === "https:" && PUSH_HOSTS.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
const endpoint = z.string().max(2048).refine(isPushServiceUrl, "Not a browser push service address");

/**
 * POST /notifications/push/subscriptions: the browser's PushSubscription
 * (`subscription.toJSON()`: endpoint + keys; expirationTime is ignored), plus
 * an optional user agent so the user can tell their devices apart.
 */
export const pushSubscriptionDtoSchema = z.object({
  endpoint,
  keys: z.object({ p256dh: base64url(200), auth: base64url(100) }),
  userAgent: z
    .string()
    .trim()
    .max(400)
    .nullable()
    .optional()
    .transform((v) => v || null),
});
export type PushSubscriptionDto = z.infer<typeof pushSubscriptionDtoSchema>;

/** POST /notifications/push/subscriptions/unsubscribe: this browser turns push off. */
export const unsubscribeDtoSchema = z.object({ endpoint });
export type UnsubscribeDto = z.infer<typeof unsubscribeDtoSchema>;
