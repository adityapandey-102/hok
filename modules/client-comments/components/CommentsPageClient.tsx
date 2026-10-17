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
import { Pager } from "../../../components/ui/Pager";
import { Input } from "../../../components/ui/Field";
import { SearchSelect } from "../../../components/ui/SearchSelect";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "../../../lib/hooks/useDebouncedValue";
import { StatusPill } from "../../../components/ui/StatusPill";
import { CommentDetailModal } from "./CommentDetailModal";

const PAGE_SIZE = 20;

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
      <div className="mb-4">
        <h1 className="page-title">Comments</h1>
        <p className="text-sm text-text-muted">
          What your clients wrote on their portal. Newest first.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Comment status"
          className="flex flex-wrap gap-1"
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
              className={`rounded-app px-3 py-1.5 text-sm font-medium ${tab === t.key ? "bg-primary text-white" : "text-text-muted hover:bg-primary-bg hover:text-text-primary"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 max-sm:w-full sm:ml-auto">
          <Input
            className="min-w-0 flex-1 sm:w-56 sm:flex-none"
            placeholder="Search comments or clients"
            aria-label="Search comments"
            maxLength={100}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
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
          <div className="p-6 text-sm text-text-muted">Loading…</div>
        ) : error ? (
          <div className="flex items-center justify-between gap-3 p-6 text-sm text-error">
            <span>{error}</span>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="font-medium underline"
            >
              Retry
            </button>
          </div>
        ) : comments.length === 0 ? (
          <div className="p-6 text-sm text-text-muted">
            {debouncedSearch
              ? "No comments match your search."
              : tab === "open"
              ? "No open comments. You are all caught up."
              : `No ${COMMENT_STATUS_LABELS[tab].toLowerCase()} comments.`}
          </div>
        ) : (
          <ul className="divide-y divide-border-light">
            {comments.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className="block w-full p-4 text-left hover:bg-primary-bg/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text-primary">
                      {c.clientName}
                    </span>
                    <StatusPill
                      label={COMMENT_STATUS_LABELS[c.status]}
                      tone={STATUS_TONES[c.status]}
                    />
                    <span className="text-xs text-text-muted sm:ml-auto">
                      {fmt(c.createdAt)}
                    </span>
                  </div>
                  {c.eventTitle && (
                    <p className="mt-0.5 text-xs text-text-muted">
                      Event: {c.eventTitle}
                    </p>
                  )}
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-text-secondary">
                    {c.body}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && (
          <Pager
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        )}
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
