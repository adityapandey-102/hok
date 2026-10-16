/**
 * In-app notifications and web push arrive in M9 (hok-api's notifications
 * module, VAPID keys, push subscriptions). Until then the bell stays hidden:
 * needleye's rule is no "coming soon" placeholders in the UI. M9 flips this
 * and gives the bell its unread count and list.
 */
export const NOTIFICATIONS_ENABLED = false;

/** The service worker file (public/sw.js), registered for the whole origin. */
export const SERVICE_WORKER_URL = "/sw.js";
