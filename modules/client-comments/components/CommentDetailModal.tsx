"use client";

import { useState } from "react";
import { isApiErrorCode } from "../../../lib/api/client";
import {
  clientCommentsApi,
  type ClientComment,
} from "../api/clientCommentsApi";
import {
  allowedMoves,
  COMMENT_STATUS_LABELS,
  moveLabel,
  STATUS_TONES,
  type CommentStatus,
} from "../lib/commentStatus";
import { Button } from "../../../components/ui/Button";
import { FieldLabel } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { Textarea } from "../../../components/ui/Select";
import { StatusPill } from "../../../components/ui/StatusPill";

const REPLY_MAX = 2000;

/** One comment: change status (allowed moves only) and write or clear the reply. */
export function CommentDetailModal({
  comment,
  viewerTimeZone,
  onClose,
  onChanged,
}: {
  comment: ClientComment;
  viewerTimeZone: string;
  onClose: () => void;
  onChanged: (c: ClientComment) => void;
}) {
  const [current, setCurrent] = useState(comment);
  const [reply, setReply] = useState(comment.reply ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  async function save(status?: CommentStatus) {
    if (reply.length > REPLY_MAX) {
      setError(`The reply can be at most ${REPLY_MAX} characters.`);
      return;
    }
    const replyChanged = reply.trim() !== (current.reply ?? "");
    if (!status && !replyChanged) {
      setError("Nothing to save.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { comment: saved } = await clientCommentsApi.update(current.id, {
        ...(status ? { status } : {}),
        ...(replyChanged
          ? { reply: reply.trim() === "" ? null : reply.trim() }
          : {}),
        version: current.version,
      });
      setCurrent(saved);
      setReply(saved.reply ?? "");
      onChanged(saved);
    } catch (err) {
      if (isApiErrorCode(err, "COMMENT_MODIFIED")) {
        setStale(true);
        setError("Someone else changed this comment.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    } finally {
      setBusy(false);
    }
  }

  async function reload() {
    try {
      const { comment: fresh } = await clientCommentsApi.get(current.id);
      setCurrent(fresh);
      setReply(fresh.reply ?? "");
      setStale(false);
      setError(null);
      onChanged(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reload");
    }
  }

  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: viewerTimeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(current.createdAt));

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="comment-title"
      panelClassName="max-w-lg"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="comment-title"
              className="font-serif text-lg font-bold text-text-primary"
            >
              {current.clientName}
            </h2>
            <p className="text-xs text-text-muted">
              {[
                current.eventTitle
                  ? `Event: ${current.eventTitle}`
                  : "General comment",
                when,
              ].join(" · ")}
            </p>
          </div>
          <StatusPill
            label={COMMENT_STATUS_LABELS[current.status]}
            tone={STATUS_TONES[current.status]}
          />
        </div>
        <p className="mt-3 whitespace-pre-wrap break-words rounded-app bg-primary-bg/50 p-3 text-sm text-text-primary">
          {current.body}
        </p>

        <div className="mt-4">
          <FieldLabel htmlFor="comment-reply">
            Reply (shown to the client)
          </FieldLabel>
          <Textarea
            id="comment-reply"
            rows={4}
            maxLength={REPLY_MAX}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          <p className="mt-1 text-xs text-text-muted">
            {reply.length}/{REPLY_MAX}. Leave empty to clear the reply.
            {current.repliedAt && current.repliedByName
              ? ` Last reply by ${current.repliedByName}.`
              : ""}
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 flex flex-wrap items-center gap-2 text-sm text-error"
          >
            {error}
            {stale && (
              <button
                type="button"
                onClick={reload}
                className="font-medium underline"
              >
                Reload latest
              </button>
            )}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="outline"
            disabled={busy || stale}
            onClick={() => save()}
          >
            Save reply
          </Button>
          {allowedMoves(current.status).map((to) => (
            <Button key={to} disabled={busy || stale} onClick={() => save(to)}>
              {moveLabel(current.status, to)}
            </Button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
