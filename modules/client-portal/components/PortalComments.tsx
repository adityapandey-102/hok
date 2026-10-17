"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel } from "../../../components/ui/Field";
import { StatusPill } from "../../../components/ui/StatusPill";
import { PortalApiError, publicPortalApi, type PortalComment, type PortalEvent } from "../api/publicPortalApi";
import { COMMENT_STATUS_LABEL, COMMENT_STATUS_TONE, formatShortDate } from "../portalFormat";

const MAX = 2000;
const PAGE = 20;

/**
 * Comments (FR-CMT-01/05): the client writes to their manager, about one of
 * their events or in general, and sees each comment's status and reply. The
 * manager is notified by push and in the app (never email).
 */
export function PortalComments({ token, zone, events }: { token: string; zone: string; events: PortalEvent[] }) {
  const [comments, setComments] = useState<PortalComment[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [eventId, setEventId] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const load = useCallback(
    (offset = 0) => {
      let cancelled = false;
      publicPortalApi
        .comments(token, PAGE, offset)
        .then((r) => {
          if (cancelled) return;
          setComments((prev) => (offset === 0 ? r.comments : [...(prev ?? []), ...r.comments]));
          setTotal(r.total);
        })
        .catch((e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : "Could not load your comments."));
      return () => {
        cancelled = true;
      };
    },
    [token],
  );

  useEffect(() => load(0), [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) {
      setSendError("Write a comment first.");
      return;
    }
    setSending(true);
    setSendError(null);
    setSent(false);
    try {
      const { comment } = await publicPortalApi.postComment(token, body, eventId || null);
      setComments((prev) => [comment, ...(prev ?? [])]);
      setTotal((n) => n + 1);
      setText("");
      setEventId("");
      setSent(true);
    } catch (err) {
      setSendError(err instanceof PortalApiError && err.status === 429 ? err.message : err instanceof Error ? err.message : "Could not send your comment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="comments-title">
      <h2 id="comments-title" className="mb-2 text-sm font-semibold text-text-secondary">
        Comments for your account manager
      </h2>
      <Card className="p-5">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <FieldLabel htmlFor="portal-comment-event">About</FieldLabel>
            <select
              id="portal-comment-event"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="w-full rounded-app border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="">General</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="portal-comment-text" required>
              Your comment
            </FieldLabel>
            <textarea
              id="portal-comment-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, MAX));
                setSent(false);
              }}
              rows={4}
              maxLength={MAX}
              placeholder="e.g. Please change the background music in the reel."
              className="w-full rounded-app border border-border bg-card px-3 py-2 text-sm"
            />
            <p className="text-right text-[11px] text-text-muted">
              {text.length}/{MAX}
            </p>
          </div>
          <FieldError>{sendError}</FieldError>
          {sent && (
            <p className="text-sm text-success" aria-live="polite">
              Sent. Your account manager has been notified.
            </p>
          )}
          <div>
            <Button type="submit" disabled={sending}>
              {sending ? "Sending…" : "Send comment"}
            </Button>
          </div>
        </form>

        <div className="mt-6 border-t border-border-light pt-4">
          {loadError ? (
            <div className="text-sm">
              <p role="alert" className="text-error">
                {loadError}
              </p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => {
                  setLoadError(null);
                  load(0);
                }}
              >
                Try again
              </Button>
            </div>
          ) : comments === null ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-text-muted">No comments yet.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {comments.map((c) => (
                <li key={c.id}>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <span>{formatShortDate(c.createdAt, zone)}</span>
                    {c.eventTitle && <span>· {c.eventTitle}</span>}
                    <StatusPill label={COMMENT_STATUS_LABEL[c.status]} tone={COMMENT_STATUS_TONE[c.status]} />
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-line text-text-primary">{c.body}</p>
                  {c.reply && (
                    <div className="mt-2 rounded-app bg-primary-bg px-3 py-2">
                      <p className="text-[11px] font-semibold text-text-secondary">Reply{c.repliedAt ? ` · ${formatShortDate(c.repliedAt, zone)}` : ""}</p>
                      <p className="text-sm whitespace-pre-line text-text-primary">{c.reply}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {comments && comments.length < total && (
            <Button variant="ghost" className="mt-3" onClick={() => load(comments.length)}>
              Show older comments
            </Button>
          )}
        </div>
      </Card>
    </section>
  );
}
