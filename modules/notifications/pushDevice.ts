import { notificationsApi } from "./api/notificationsApi";

/**
 * Stops push notifications on THIS browser: removes its subscription from
 * hok-api, and unsubscribes it locally even if that call fails, so the
 * device stops receiving either way. Used by "turn off push" and on sign
 * out, so a shared device never keeps showing the previous person's
 * notifications (review 2026-10-22).
 */
export async function unsubscribeThisDevice(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  try {
    await notificationsApi.unsubscribePush(sub.endpoint);
  } finally {
    await sub.unsubscribe();
  }
}
