/*
 * HOK service worker (registered by modules/notifications on the staff app).
 *
 * Deliberately small: it exists so the app can show web push notifications
 * (M9). There is NO fetch handler and NO offline caching -- every request goes
 * to the network as usual, so staff always see live data. (Browsers no longer
 * need a fetch handler to offer installation; the manifest is enough.)
 *
 * Push payload (sent by hok-api in M9), JSON:
 *   { "title": "New client comment", "body": "…", "url": "/app/comments/…", "tag": "…" }
 * Only same-origin URLs are opened; anything else falls back to /app.
 */

self.addEventListener("install", () => {
  // Activate a new version straight away instead of waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** A same-origin path from the payload, or /app. Never opens another site. */
function safeUrl(raw) {
  try {
    const url = new URL(raw || "/app", self.location.origin);
    return url.origin === self.location.origin ? url.href : new URL("/app", self.location.origin).href;
  } catch {
    return new URL("/app", self.location.origin).href;
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title ? data.title : "HOK";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      data: { url: safeUrl(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      // Reuse an open HOK window if there is one, otherwise open a new one.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) return client.navigate(target);
          return undefined;
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
