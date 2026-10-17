"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  clientCommentsApi,
  type ClientComment,
} from "../api/clientCommentsApi";
import { clientsApi } from "../../clients/api/clientsApi";
import {
  COMMENT_STATUS_LABELS,
  STATUS_TONES,
  type CommentStatus,
} from "../lib/commentStatus";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Pager } from "../../../components/ui/Pager";
import { Input } from "../../../components/ui/Field";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { Icon } from "../../../components/ui/Icon";
import { StatusPill } from "../../../components/ui/StatusPill";
import { CommentDetailModal } from "./CommentDetailModal";

const PAGE_SIZE = 20;

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

type Tab = "open" | CommentStatus;
const TABS: { key: Tab; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "received", label: "Received" },
  { key: "in_progress", label: "In progress" },
  { key: "solved", label: "Solved" },
];

/** /app/comments: the client comment inbox. "Open" = received + in progress (the API default). */
export function CommentsPageClient({
  viewerTimeZone,
}: {
  viewerTimeZone: string;
}) {
  const params = useSearchParams();
  const deepLinkId = params.get("commentId");
  const [tab, setTab] = useState<Tab>("open");
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const [page, setPage] = useState(0);
  const [comments, setComments] = useState<ClientComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<ClientComment | null>(null);
  const openedDeepLink = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      setLoading(true);
      clientCommentsApi
        .list({
          clientId: clientId || undefined,
          search: debouncedSearch || undefined,
          status: tab === "open" ? undefined : tab,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        })
        .then((d) => {
          if (cancelled) return;
          setComments(d.comments);
          setTotal(d.total);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled)
            setError(
              err instanceof Error ? err.message : "Failed to load comments",
            );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [tab, clientId, debouncedSearch, page, reloadKey]);

  // ?commentId= from a notification opens that comment once.
  useEffect(() => {
    if (!deepLinkId || openedDeepLink.current === deepLinkId) return;
    openedDeepLink.current = deepLinkId;
    clientCommentsApi
      .get(deepLinkId)
      .then((d) => setSelected(d.comment))
      .catch(() => {
        // Unknown or another manager comment: just show the inbox.
      });
  }, [deepLinkId]);

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: viewerTimeZone,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="page-title">Comments</h1>
        <p className="text-sm text-text-muted">What your clients wrote on their portal. Newest first.</p>
      </header>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div
          role="tablist"
          aria-label="Comment status"
          className="grid grid-cols-4 gap-0.5 rounded-app border border-border bg-card p-0.5 shadow-app lg:inline-flex"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => {
                setTab(t.key);
                setPage(0);
              }}
              className={`rounded-app-sm px-2 py-2 text-[13px] font-medium whitespace-nowrap transition-colors sm:px-4 ${
                tab === t.key ? "bg-ink text-on-ink" : "text-text-secondary hover:bg-accent-bg hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:ml-auto">
          <div className="relative sm:w-64">
            <Icon name="search" size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
            <Input
              className="pl-9"
              placeholder="Search comments or clients"
              aria-label="Search comments"
              maxLength={100}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
            />
          </div>
          <SearchSelect
            className="sm:w-56"
            aria-label="Filter by client"
            placeholder="All clients"
            value={clientId || null}
            clearable
            load={clientsApi.searchOptions}
            onChange={(id) => {
              setClientId(id ?? "");
              setPage(0);
            }}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-app-lg border border-border bg-card shadow-app">
        {loading ? (
          <ul className="divide-y divide-border-light" aria-busy="true" aria-label="Loading comments">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex gap-3 px-5 py-4">
                <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-1/3 rounded-app-sm" />
                  <div className="skeleton h-3 w-full rounded-app-sm" />
                  <div className="skeleton h-3 w-2/3 rounded-app-sm" />
                </div>
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="flex items-center justify-between gap-3 p-6 text-sm text-error">
            <span>{error}</span>
            <button onClick={() => setReloadKey((k) => k + 1)} className="font-medium underline">
              Retry
            </button>
          </div>
        ) : comments.length === 0 ? (
          <EmptyState
            icon={tab === "open" && !debouncedSearch ? "check-circle" : "message"}
            title={
              debouncedSearch
                ? "No comments match your search."
                : tab === "open"
                  ? "No open comments. You are all caught up."
                  : `No ${COMMENT_STATUS_LABELS[tab].toLowerCase()} comments.`
            }
            description={tab === "open" && !debouncedSearch ? "New client comments will appear here." : undefined}
          />
        ) : (
          <ul className="divide-y divide-border-light">
            {comments.map((c, i) => {
              const needsReply = c.status === "received";
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c)}
                    style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                    className="group animate-fade-in relative flex w-full items-start gap-3.5 px-5 py-4 text-left transition-colors hover:bg-accent-bg"
                  >
                    {needsReply && <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-primary" />}
                    <span
                      aria-hidden
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                        needsReply ? "bg-ink text-on-ink" : "bg-accent-bg text-text-secondary ring-1 ring-border ring-inset"
                      }`}
                    >
                      {initials(c.clientName)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={`text-[14px] text-text-primary ${needsReply ? "font-semibold" : "font-medium"}`}>{c.clientName}</span>
                        {needsReply && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />}
                        <StatusPill label={COMMENT_STATUS_LABELS[c.status]} tone={STATUS_TONES[c.status]} />
                        <span className="text-xs text-text-muted sm:ml-auto">{fmt(c.createdAt)}</span>
                      </span>
                      {c.eventTitle && (
                        <span className="mt-1 inline-flex max-w-full items-center gap-1 truncate rounded-app-sm bg-accent-bg px-1.5 py-0.5 text-[11.5px] text-text-muted">
                          <Icon name="calendar" size={11} />
                          <span className="truncate">{c.eventTitle}</span>
                        </span>
                      )}
                      <span className={`mt-1 line-clamp-2 block text-sm break-words whitespace-pre-wrap ${needsReply ? "text-text-primary" : "text-text-secondary"}`}>{c.body}</span>
                    </span>
                    <Icon name="chevron-right" size={15} className="mt-3 hidden shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 sm:block" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {!loading && !error && <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}
      </div>

      {selected && (
        <CommentDetailModal
          comment={selected}
          viewerTimeZone={viewerTimeZone}
          onClose={() => setSelected(null)}
          onChanged={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
