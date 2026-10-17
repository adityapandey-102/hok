import type { ClientCommentEntity, CommentCounts, CommentScope, CommentStatus, PortalCommentEntity } from "../../domain/client-comment.entity";

export interface CommentListFilters {
  clientId?: string;
  /** No status = the open inbox (received + in_progress). */
  status?: CommentStatus;
  limit: number;
  offset: number;
}

/** What the guard decides inside the locked transaction. */
export interface CommentChange {
  status?: CommentStatus;
  /** undefined = leave the reply; null = clear it. */
  reply?: string | null;
}

export interface ClientCommentsRepositoryPort {
  // -- staff (inbox) --
  list(scope: CommentScope, filters: CommentListFilters): Promise<{ comments: ClientCommentEntity[]; total: number }>;
  counts(scope: CommentScope): Promise<CommentCounts>;
  findById(id: string): Promise<ClientCommentEntity | null>;
  /**
   * One transaction: lock the comment, pass it to `decide` (scope, version and
   * transition checks throw there), write the change, append a history row
   * when the status changed, bump the version. Returns the updated comment.
   */
  update(id: string, changedBy: string, decide: (current: ClientCommentEntity) => CommentChange): Promise<ClientCommentEntity>;

  // -- portal (pinned to the client the link opens) --
  listForPortal(clientId: string, limit: number, offset: number): Promise<{ comments: PortalCommentEntity[]; total: number }>;
  /** Is this event one of the client's own? (A comment may name one of them only.) */
  eventBelongsToClient(clientId: string, eventId: string): Promise<boolean>;
  createFromPortal(input: { clientId: string; portalLinkId: string; eventId: string | null; body: string }): Promise<PortalCommentEntity>;
}
