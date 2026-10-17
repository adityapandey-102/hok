"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "../../../components/ui/Icon";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Loader } from "../../../components/ui/Loader";
import { NOTIFICATIONS_ENABLED } from "../config";
import {
  notificationsApi,
  type AppNotification,
} from "../api/notificationsApi";
import { badgeLabel, notificationIcon, safeAppPath, timeAgo } from "../format";
import { PushPrompt } from "./PushPrompt";

const POLL_MS = 60_000;

/**
 * The header bell: an unread badge (polled every 60s, paused while the tab is
 * hidden) and a dropdown with the latest 10. Clicking one marks it read and
 * opens its page.
 */
export function NotificationBell({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      setCount((await notificationsApi.unreadCount()).count);
    } catch {
      /* a failed poll keeps the last badge */
    }
  }, []);

  useEffect(() => {
    if (!NOTIFICATIONS_ENABLED) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      void refreshCount();
      timer = setInterval(refreshCount, POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshCount]);

  const loadItems = useCallback(async () => {
    try {
      const page = await notificationsApi.list({ limit: 10, offset: 0 });
      setItems(page.notifications);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    notificationsApi
      .list({ limit: 10, offset: 0 })
      .then((p) => {
        setItems(p.notifications);
        setError(false);
      })
      .catch(() => setError(true));
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!NOTIFICATIONS_ENABLED) return null;

  async function openItem(n: AppNotification) {
    setOpen(false);
    if (!n.readAt) {
      setItems(
        (prev) =>
          prev?.map((x) =>
            x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x,
          ) ?? prev,
      );
      setCount((c) => Math.max(0, c - 1));
      try {
        await notificationsApi.markRead(n.id);
      } catch {
        void refreshCount();
      }
    }
    const path = safeAppPath(n.url);
    if (path) router.push(path);
  }

  async function markAll() {
    try {
      await notificationsApi.markAllRead();
      setCount(0);
      setItems(
        (prev) =>
          prev?.map((x) => ({
            ...x,
            readAt: x.readAt ?? new Date().toISOString(),
          })) ?? prev,
      );
    } catch {
      setError(true);
    }
  }

  const label = badgeLabel(count);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        className="relative rounded-app p-2.5 text-text-secondary transition-colors hover:bg-accent-bg hover:text-text-primary"
        aria-label={
          count > 0 ? `Notifications, ${count} unread` : "Notifications"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" size={20} />
        {label && (
          <span
            data-testid="bell-badge"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-on-ink"
          >
            {label}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-14 z-50 overflow-hidden rounded-app-lg border border-border bg-card shadow-app-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-border-light px-4 py-3">
            <h2 className="font-serif text-base text-text-primary">
              Notifications
            </h2>
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              disabled={count === 0}
              onClick={markAll}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {error ? (
              <p className="px-4 py-6 text-center text-sm text-error">
                Could not load notifications.{" "}
                <button
                  type="button"
                  className="font-semibold underline"
                  onClick={loadItems}
                >
                  Retry
                </button>
              </p>
            ) : items === null ? (
              <div className="flex justify-center py-8">
                <Loader label="Loading notifications" />
              </div>
            ) : items.length === 0 ? (
              <EmptyState compact icon="check-circle" title="You are all caught up." />
            ) : (
              <ul>
                {items.map((n) => (
                  <li
                    key={n.id}
                    className="border-t border-border-light first:border-t-0"
                  >
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent-bg ${n.readAt ? "opacity-70" : ""}`}
                    >
                      <span
                        aria-hidden
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${
                          n.readAt ? "bg-accent-bg text-text-muted ring-border" : "bg-primary-bg text-primary ring-primary/20"
                        }`}
                      >
                        <Icon name={notificationIcon(n.type)} size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-text-primary">
                          {n.title}
                        </span>
                        {n.body && (
                          <span className="block truncate text-xs text-text-secondary">
                            {n.body}
                          </span>
                        )}
                        <span className="block text-[11px] text-text-muted">
                          {timeAgo(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2 border-t border-border-light px-4 py-3">
            <PushPrompt />
            <Link
              href="/app/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-semibold text-primary hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
