/** "just now", "5m ago", "3h ago", "2d ago", else a short date. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Badge text: capped at 99+. Empty string when there is nothing unread. */
export function badgeLabel(count: number): string {
  if (count <= 0) return "";
  return count > 99 ? "99+" : String(count);
}

/** Only same-app paths are navigated to; anything else is ignored. */
export function safeAppPath(url: string | null): string | null {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : null;
}

/** VAPID base64url public key -> the bytes PushManager.subscribe wants. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** The icon that says what kind of notification this is. */
export function notificationIcon(type: string): "message" | "clipboard" | "refresh" | "users" | "bell" {
  switch (type) {
    case "client_comment":
    case "task_commented":
      return "message";
    case "task_assigned":
      return "clipboard";
    case "task_status_changed":
      return "refresh";
    case "client_reassigned":
      return "users";
    default:
      return "bell";
  }
}
