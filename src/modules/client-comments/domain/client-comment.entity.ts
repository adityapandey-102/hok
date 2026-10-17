/** FR-CMT-03: a comment starts as `received`; the manager works it to `solved`. */
export const COMMENT_STATUSES = ["received", "in_progress", "solved"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export const COMMENT_BODY_MAX = 2000;
export const COMMENT_REPLY_MAX = 2000;

/** A client comment as staff see it (the manager's inbox). */
export interface ClientCommentEntity {
  id: string;
  clientId: string;
  clientName: string;
  ownerId: string;
  eventId: string | null;
  eventTitle: string | null;
  body: string;
  status: CommentStatus;
  reply: string | null;
  repliedAt: string | null;
  repliedByName: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * The same comment as the CLIENT sees it on their portal (FR-CMT-05): their
 * text, its status and the reply. Never staff names, ids beyond the
 * comment's own and the event's, or the version.
 */
export interface PortalCommentEntity {
  id: string;
  eventId: string | null;
  eventTitle: string | null;
  body: string;
  status: CommentStatus;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

/** The inbox badge (FR-CMT-06): unsolved comments by status. */
export interface CommentCounts {
  received: number;
  inProgress: number;
}

/** Who may see which comments (comments:read / comments:manage). */
export type CommentScope = { kind: "all" } | { kind: "own"; userId: string };
