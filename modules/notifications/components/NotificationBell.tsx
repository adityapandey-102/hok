"use client";

import { Icon } from "../../../components/ui/Icon";
import { NOTIFICATIONS_ENABLED } from "../config";

/**
 * The header's notification bell. Renders nothing until M9 turns
 * notifications on (`NOTIFICATIONS_ENABLED`), so the UI never shows a control
 * that does nothing. M9 adds the unread badge and the list it opens.
 */
export function NotificationBell({ className = "" }: { className?: string }) {
  if (!NOTIFICATIONS_ENABLED) return null;
  return (
    <button
      type="button"
      className={`rounded-app p-2 text-text-secondary transition-colors hover:bg-app-bg ${className}`}
      aria-label="Notifications"
    >
      <Icon name="bell" size={20} />
    </button>
  );
}
