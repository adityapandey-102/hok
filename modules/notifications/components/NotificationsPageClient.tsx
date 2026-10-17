"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { Pager } from "../../../components/ui/Pager";
import { useToast } from "../../../components/ui/Toast";
import {
  notificationsApi,
  type NotificationListResult,
} from "../api/notificationsApi";
import { safeAppPath, timeAgo } from "../format";

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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-bold text-text-primary">
          Notifications
        </h1>
        <Button
          variant="outline"
          onClick={markAll}
          disabled={!data || data.notifications.every((n) => n.readAt)}
        >
          <Icon name="check" size={16} /> Mark all read
        </Button>
      </div>
      <Card>
        {error ? (
          <div className="p-6 text-center text-sm text-error">
            {error}{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={load}
            >
              Retry
            </button>
          </div>
        ) : !data ? (
          <p className="p-6 text-center text-sm text-text-muted">Loading…</p>
        ) : data.notifications.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-muted">
            <Icon name="bell" size={24} className="mx-auto mb-2" />
            No notifications yet.
          </div>
        ) : (
          <ul>
            {data.notifications.map((n) => (
              <li
                key={n.id}
                className="border-t border-border-light first:border-t-0"
              >
                <button
                  type="button"
                  onClick={() => open(n.id, n.url, !!n.readAt)}
                  className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-primary-bg ${n.readAt ? "" : "bg-primary-bg/50"}`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-primary"}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-text-primary">
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="block text-sm text-text-secondary">
                        {n.body}
                      </span>
                    )}
                    <span className="block text-xs text-text-muted">
                      {n.actorName ? `${n.actorName} · ` : ""}
                      {timeAgo(n.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {data && (
          <Pager
            page={page}
            pageSize={PAGE_SIZE}
            total={data.total}
            onPageChange={setPage}
          />
        )}
      </Card>
    </div>
  );
}
