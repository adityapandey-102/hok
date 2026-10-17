import { BadRequestError, ConflictError, NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import type { ClientCommentEntity, CommentScope, CommentStatus } from "./client-comment.entity";

/**
 * Allowed status moves (FR-CMT-03). Forward: received -> in_progress -> solved
 * (received -> solved directly is fine for a quick fix). A solved comment can
 * be reopened to in_progress. Nothing ever goes back to `received`: that
 * status means "nobody has looked at it yet".
 */
const ALLOWED: Record<CommentStatus, readonly CommentStatus[]> = {
  received: ["in_progress", "solved"],
  in_progress: ["solved"],
  solved: ["in_progress"],
};

export function assertStatusTransition(from: CommentStatus, to: CommentStatus): void {
  if (from === to) return; // a reply-only update keeps the status
  if (!ALLOWED[from].includes(to)) {
    throw new ConflictError(`A comment can't move from ${from} to ${to}.`, ERROR_CODES.COMMENT_STATUS_TRANSITION_INVALID);
  }
}

/** Another manager's comment is the same 404 as a missing one (no existence leak). */
export function assertCommentVisible(scope: CommentScope, comment: ClientCommentEntity | null): ClientCommentEntity {
  if (!comment || (scope.kind === "own" && comment.ownerId !== scope.userId)) {
    throw new NotFoundError("Comment not found", ERROR_CODES.COMMENT_NOT_FOUND);
  }
  return comment;
}

/** Optimistic lock: the caller must have seen the latest version. */
export function assertVersion(current: number, given: number): void {
  if (current !== given) {
    throw new ConflictError("Someone else changed this comment. Reload and try again.", ERROR_CODES.COMMENT_MODIFIED);
  }
}

/** An update must change something. */
export function assertHasChange(status: CommentStatus | undefined, reply: string | null | undefined): void {
  if (status === undefined && reply === undefined) {
    throw new BadRequestError("Send a new status, a reply, or both.", ERROR_CODES.VALIDATION_NO_FIELDS);
  }
}

/** A short excerpt for notifications (never the whole comment). */
export function excerpt(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}
