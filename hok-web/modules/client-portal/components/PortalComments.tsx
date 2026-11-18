"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "../../../components/ui/Icon";
import { Panel } from "../../../components/ui/Panel";
import { Select, Textarea } from "../../../components/ui/Select";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Button } from "../../../components/ui/Button";
import { FieldError, FieldLabel } from "../../../components/ui/Field";
import { publicPortalApi, type PortalComment, type PortalEvent } from "../api/publicPortalApi";
import { COMMENT_MAX as MAX, useCommentComposer } from "../commentComposer";
import { PortalCommentItem } from "./PortalCommentItem";

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
  const [eventId, setEventId] = useState("");
  const composer = useCommentComposer(token, (comment) => {
    setComments((prev) => [comment, ...(prev ?? [])]);
    setTotal((n) => n + 1);
    setEventId("");
  });
  const { text, sending, error: sendError, sent } = composer;

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void composer.submit(eventId || null);
  }

  return (
    <Panel icon="message" title="Comments for your account manager" subtitle="Write here and your manager is notified straight away">
      <div className="p-5">
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
              onChange={(e) => composer.setText(e.target.value)}
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
                <PortalCommentItem key={c.id} comment={c} zone={zone} />
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
