import { logger } from "../../lib/logging/logger";
import { SERVICE_WORKER_URL } from "./config";

/**
 * Registers public/sw.js (push + notification clicks; no offline caching).
 * Safe to call on every page load: the browser keeps one registration and
 * only re-downloads the file when it changed (`updateViaCache: "none"` makes
 * it skip the HTTP cache). Never throws: a browser without service workers,
 * or a failed registration, just means no push on this device.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator))
    return null;
  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
      scope: "/",
      updateViaCache: "none",
    });
  } catch (err) {
    logger.warn("Service worker registration failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
