"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../../components/ui/Icon";
import { Panel } from "../../../components/ui/Panel";
import { Select, Textarea } from "../../../components/ui/Select";
import { EmptyState } from "../../../components/ui/EmptyState";
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
    <Panel icon="message" title="Comments for your account manager" subtitle="Write here and your manager is notified straight away">
      <div className="px-5 pb-5">
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-app-lg bg-accent-bg p-4 ring-1 ring-border-light ring-inset">
          <div>
            <FieldLabel htmlFor="portal-comment-event">About</FieldLabel>
            <Select id="portal-comment-event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
              <option value="">General</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="portal-comment-text" required>
              Your comment
            </FieldLabel>
            <Textarea
              id="portal-comment-text"
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, MAX));
                setSent(false);
              }}
              rows={4}
              maxLength={MAX}
              placeholder="e.g. Please change the background music in the reel."
            />
            <p className="mt-1 text-right text-[11px] text-text-muted">
              {text.length}/{MAX}
            </p>
          </div>
          <FieldError>{sendError}</FieldError>
          {sent && (
            <p className="flex items-center gap-1.5 text-sm text-success" aria-live="polite">
              <Icon name="check-circle" size={15} /> Sent. Your account manager has been notified.
            </p>
          )}
          <div>
            <Button type="submit" disabled={sending} className="max-sm:w-full">
              <Icon name="send" size={15} /> {sending ? "Sending…" : "Send comment"}
            </Button>
          </div>
        </form>

        <div className="mt-6">
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
            <div className="space-y-3" aria-busy="true" aria-label="Loading comments">
              <div className="skeleton h-14 rounded-app" />
              <div className="skeleton h-14 rounded-app" />
            </div>
          ) : comments.length === 0 ? (
            <EmptyState compact icon="message" title="No comments yet." description="Anything you write above reaches your account manager." />
          ) : (
            <ul className="flex flex-col gap-5">
              {comments.map((c) => (
                <li key={c.id} className="border-l-2 border-border pl-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    <span>{formatShortDate(c.createdAt, zone)}</span>
                    {c.eventTitle && <span>· {c.eventTitle}</span>}
                    <StatusPill label={COMMENT_STATUS_LABEL[c.status]} tone={COMMENT_STATUS_TONE[c.status]} />
                  </div>
                  <p className="mt-1.5 text-sm break-words whitespace-pre-line text-text-primary">{c.body}</p>
                  {c.reply && (
                    <div className="mt-2.5 rounded-app-lg rounded-tl-sm border border-border-light bg-accent-bg px-3.5 py-2.5">
                      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-text-secondary">
                        <Icon name="message" size={12} /> Reply{c.repliedAt ? ` · ${formatShortDate(c.repliedAt, zone)}` : ""}
                      </p>
                      <p className="mt-0.5 text-sm break-words whitespace-pre-line text-text-primary">{c.reply}</p>
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
      </div>
    </Panel>
  );
}
