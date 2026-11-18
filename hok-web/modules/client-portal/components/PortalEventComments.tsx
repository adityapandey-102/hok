"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { FieldError } from "../../../components/ui/Field";
import { Icon } from "../../../components/ui/Icon";
import { Textarea } from "../../../components/ui/Select";
import { publicPortalApi, type PortalComment } from "../api/publicPortalApi";
import { COMMENT_MAX, useCommentComposer } from "../commentComposer";
import { PortalCommentItem } from "./PortalCommentItem";

const PAGE = 5;

/**
 * "Comments on this event" (round 5): the client writes to their manager right from the event sheet.
 * The event is fixed (no picker). This event's comments sit above the composer, newest first, five at
 * a time. Validation and sending are shared with the Messages tab (commentComposer.ts).
 */
export function PortalEventComments({ token, zone, eventId, eventTitle, onPosted }: { token: string; zone: string; eventId: string; eventTitle: string; onPosted?: () => void }) {
  const [comments, setComments] = useState<PortalComment[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const composer = useCommentComposer(
    token,
    (comment) => {
      setComments((prev) => [comment, ...(prev ?? [])]);
      setTotal((n) => n + 1);
      onPosted?.();
    },
    3000,
  );

  const load = useCallback(
    (offset = 0) => {
      let cancelled = false;
      publicPortalApi
        .comments(token, PAGE, offset, eventId)
        .then((r) => {
          if (cancelled) return;
          setComments((prev) => (offset === 0 ? r.comments : [...(prev ?? []), ...r.comments]));
          setTotal(r.total);
        })
        .catch((e: unknown) => !cancelled && setLoadError(e instanceof Error ? e.message : "Could not load the comments."));
      return () => {
        cancelled = true;
      };
    },
    [token, eventId],
  );

  useEffect(() => load(0), [load]);

  return (
    <section id="pe-comment" aria-label="Comments on this event" className="mt-7 scroll-mt-24">
      <h3 className="mb-3 font-serif text-[17px] text-text-primary">Comments on this event</h3>
      {loadError ? (
        <div className="mb-4 text-sm">
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
        <div className="mb-4 space-y-3" aria-busy="true" aria-label="Loading comments">
          <div className="skeleton h-12 rounded-app" />
        </div>
      ) : (
        comments.length > 0 && (
          <ul data-testid="event-comments" className="mb-4 flex flex-col gap-4">
            {comments.map((c) => (
              <PortalCommentItem key={c.id} comment={c} zone={zone} showEvent={false} />
            ))}
          </ul>
        )
      )}
      {comments && comments.length < total && (
        <Button variant="ghost" className="mb-4 min-h-11" onClick={() => load(comments.length)}>
          Show more
        </Button>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void composer.submit(eventId);
        }}
        className="flex flex-col gap-2.5 rounded-app-lg bg-accent-bg p-3.5 ring-1 ring-border-light ring-inset"
      >
        <label htmlFor="pe-comment-text" className="sr-only">
          Your comment about {eventTitle}
        </label>
        <Textarea
          id="pe-comment-text"
          rows={3}
          maxLength={COMMENT_MAX}
          value={composer.text}
          onChange={(e) => composer.setText(e.target.value)}
          placeholder={`Write a comment about ${eventTitle}…`}
        />
        <FieldError>{composer.error}</FieldError>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p aria-live="polite" className="min-h-5 text-[13px] text-success">
            {composer.sent && (
              <span className="flex items-center gap-1.5">
                <Icon name="check-circle" size={14} /> Sent. Your account manager has been notified.
              </span>
            )}
          </p>
          <Button type="submit" disabled={composer.sending} className="min-h-11 max-sm:w-full">
            <Icon name="send" size={15} /> {composer.sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>
    </section>
  );
}
