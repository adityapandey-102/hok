import { useEffect, useState } from "react";
import { PortalApiError, publicPortalApi, type PortalComment } from "./api/publicPortalApi";

/** The one place the portal validates and sends a client comment (Messages tab and the event sheet share it). */
export const COMMENT_MAX = 2000;

export type SendResult = { ok: true; comment: PortalComment } | { ok: false; error: string };

/** Trims, refuses an empty comment, posts with the event (or none), and turns any failure into a sentence for the client. */
export async function sendPortalComment(
  token: string,
  rawText: string,
  eventId: string | null,
  post: typeof publicPortalApi.postComment = publicPortalApi.postComment,
): Promise<SendResult> {
  const body = rawText.trim();
  if (!body) return { ok: false, error: "Write a comment first." };
  try {
    const { comment } = await post(token, body.slice(0, COMMENT_MAX), eventId);
    return { ok: true, comment };
  } catch (err) {
    return { ok: false, error: err instanceof PortalApiError && err.status === 429 ? err.message : err instanceof Error ? err.message : "Could not send your comment." };
  }
}

/**
 * State for a comment form: the text (capped), sending, the error, and "sent". `sentForMs` clears the
 * "sent" note after that long (the event sheet shows it for 3 seconds); without it, it stays until typing resumes.
 */
export function useCommentComposer(token: string, onPosted: (comment: PortalComment) => void, sentForMs?: number) {
  const [text, setTextRaw] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!sent || !sentForMs) return;
    const t = setTimeout(() => setSent(false), sentForMs);
    return () => clearTimeout(t);
  }, [sent, sentForMs]);

  return {
    text,
    setText: (v: string) => {
      setTextRaw(v.slice(0, COMMENT_MAX));
      setSent(false);
    },
    sending,
    error,
    sent,
    async submit(eventId: string | null) {
      setSending(true);
      setError(null);
      setSent(false);
      const r = await sendPortalComment(token, text, eventId);
      if (r.ok) {
        onPosted(r.comment);
        setTextRaw("");
        setSent(true);
      } else setError(r.error);
      setSending(false);
    },
  };
}
