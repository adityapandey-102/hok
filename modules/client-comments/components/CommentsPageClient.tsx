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
import { Select } from "../../../components/ui/Select";
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
  const [clients, setClients] = useState<
    { id: string; businessName: string }[]
  >([]);
  const [page, setPage] = useState(0);
  const [comments, setComments] = useState<ClientComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<ClientComment | null>(null);
  const openedDeepLink = useRef<string | null>(null);

  useEffect(() => {
    clientsApi
      .list({ limit: 100 })
      .then((d) =>
        setClients(
          d.clients.map((c) => ({ id: c.id, businessName: c.businessName })),
        ),
      )
      .catch(() => {
        // The client filter is a convenience.
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      setLoading(true);
      clientCommentsApi
        .list({
          clientId: clientId || undefined,
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
  }, [tab, clientId, page, reloadKey]);

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
        <Select
          className="w-auto max-sm:w-full sm:ml-auto"
          aria-label="Filter by client"
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.businessName}
            </option>
          ))}
        </Select>
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
            {tab === "open"
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
