"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pager } from "../../../components/ui/Pager";
import { useToast } from "../../../components/ui/Toast";
import {
  notificationsApi,
  type NotificationListResult,
} from "../api/notificationsApi";
import { notificationIcon, safeAppPath, timeAgo } from "../format";

const PAGE_SIZE = 20;

export function NotificationsPageClient() {
  const router = useRouter();
  const { showToast } = useToast();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<NotificationListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const load = () => setReloadTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    notificationsApi
      .list({ limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load notifications",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [page, reloadTick]);

  async function markAll() {
    try {
      await notificationsApi.markAllRead();
      load();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to mark all read",
        "error",
      );
    }
  }

  async function open(id: string, url: string | null, wasRead: boolean) {
    if (!wasRead) await notificationsApi.markRead(id).catch(() => undefined);
    const path = safeAppPath(url);
    if (path) router.push(path);
    else void load();
  }

  const unread = data?.notifications.filter((n) => !n.readAt).length ?? 0;
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="text-sm text-text-muted">{unread > 0 ? `${unread} unread on this page, marked in crimson.` : "Unread ones are marked in crimson."}</p>
        </div>
        <div className="page-actions">
          <Button variant="outline" onClick={markAll} disabled={!data || data.notifications.every((n) => n.readAt)}>
            <Icon name="check" size={16} /> Mark all read
          </Button>
        </div>
      </header>
      <Card>
        {error ? (
          <div className="p-6 text-center text-sm text-error">
            {error}{" "}
            <button type="button" className="font-semibold underline" onClick={load}>
              Retry
            </button>
          </div>
        ) : !data ? (
          <ul className="divide-y divide-border-light" aria-busy="true" aria-label="Loading notifications">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex gap-3 px-5 py-4">
                <div className="skeleton h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-1/2 rounded-app-sm" />
                  <div className="skeleton h-3 w-3/4 rounded-app-sm" />
                </div>
              </li>
            ))}
          </ul>
        ) : data.notifications.length === 0 ? (
          <EmptyState icon="bell" title="No notifications yet." description="Comments, task assignments and reminders will show up here." />
        ) : (
          <ul className="divide-y divide-border-light">
            {data.notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n.id, n.url, !!n.readAt)}
                  className={`group relative flex w-full items-start gap-3.5 px-5 py-4 text-left transition-colors hover:bg-accent-bg ${n.readAt ? "" : "bg-primary-bg/40"}`}
                >
                  {!n.readAt && <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-primary" />}
                  <span
                    aria-hidden
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${
                      n.readAt ? "bg-accent-bg text-text-muted ring-border" : "bg-primary-bg text-primary ring-primary/20"
                    }`}
                  >
                    <Icon name={notificationIcon(n.type)} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm text-text-primary ${n.readAt ? "font-medium" : "font-semibold"}`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-sm break-words text-text-secondary">{n.body}</span>}
                    <span className="mt-1 block text-xs text-text-muted">
                      {n.actorName ? `${n.actorName} · ` : ""}
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={15} className="mt-2 hidden shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 sm:block" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {data && <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={setPage} />}
      </Card>
    </div>
  );
}
