import { BadRequestError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import type { PortalContext } from "../../../common/database/portal-links";
import { getCapabilityScope, type Role } from "../../../domain";
import type { ClientCommentEntity, CommentCounts, CommentScope, CommentStatus, PortalCommentEntity } from "../domain/client-comment.entity";
import { assertCommentVisible, assertHasChange, assertStatusTransition, assertVersion } from "../domain/client-comment.rules";
import type { ClientCommentsRepositoryPort, CommentListFilters } from "./ports/client-comments-repository.port";
import type { CommentNotifier } from "./ports/comment-notifier.port";

export interface CommentsCaller {
  userId: string;
  role: Role;
}

function scopeOf(caller: CommentsCaller, capability: "comments:read" | "comments:manage"): CommentScope {
  // requireCapability has already refused `false`; "own" pins to the caller's clients.
  return getCapabilityScope(caller.role, capability) === true ? { kind: "all" } : { kind: "own", userId: caller.userId };
}

/**
 * Client comments (FR-CMT-01..08). Clients post through their portal link;
 * the owning manager (or the Admin) works them through the inbox. Every
 * staff read and write is scoped to the caller's own clients; every portal
 * read and write is pinned to the client the link opens.
 */
export class ClientCommentsService {
  constructor(
    private readonly repo: ClientCommentsRepositoryPort,
    private readonly notifier: CommentNotifier,
    private readonly audit?: AuditLogger,
  ) {}

  // -- staff --------------------------------------------------------------------

  list(caller: CommentsCaller, filters: CommentListFilters) {
    return this.repo.list(scopeOf(caller, "comments:read"), filters);
  }

  counts(caller: CommentsCaller): Promise<CommentCounts> {
    return this.repo.counts(scopeOf(caller, "comments:read"));
  }

  async get(caller: CommentsCaller, id: string): Promise<ClientCommentEntity> {
    return assertCommentVisible(scopeOf(caller, "comments:read"), await this.repo.findById(id));
  }

  /** FR-CMT-03/04: change the status and/or reply. Scope, version and transition are checked under the row lock. */
  async update(caller: CommentsCaller, id: string, input: { status?: CommentStatus; reply?: string | null; version: number }) {
    assertHasChange(input.status, input.reply);
    const scope = scopeOf(caller, "comments:manage");
    let from: CommentStatus | undefined;
    const updated = await this.repo.update(id, caller.userId, (current) => {
      assertCommentVisible(scope, current);
      assertVersion(current.version, input.version);
      if (input.status) assertStatusTransition(current.status, input.status);
      from = current.status;
      return { status: input.status, reply: input.reply };
    });
    await this.audit?.record({
      action: AUDIT_ACTIONS.COMMENT_UPDATED,
      entityType: AUDIT_ENTITIES.CLIENT,
      entityId: updated.clientId,
      metadata: { commentId: id, ...(input.status && input.status !== from ? { from, to: input.status } : {}), replied: input.reply !== undefined },
    });
    return updated;
  }

  // -- portal (the client) ------------------------------------------------------

  listForPortal(ctx: PortalContext, limit: number, offset: number) {
    return this.repo.listForPortal(ctx.clientId, limit, offset);
  }

  /** FR-CMT-01/02: post a comment (general or about one of the client's events), then notify the client's whole team. */
  async post(ctx: PortalContext, input: { body: string; eventId?: string | null }): Promise<PortalCommentEntity> {
    const eventId = input.eventId ?? null;
    if (eventId && !(await this.repo.eventBelongsToClient(ctx.clientId, eventId))) {
      throw new BadRequestError("That event isn't one of yours.", ERROR_CODES.PORTAL_EVENT_NOT_FOUND);
    }
    const comment = await this.repo.createFromPortal({ clientId: ctx.clientId, portalLinkId: ctx.linkId, eventId, body: input.body });
    await this.notifier.newClientComment({
      recipientIds: ctx.teamIds,
      clientId: ctx.clientId,
      clientName: ctx.businessName,
      commentId: comment.id,
      body: comment.body,
    });
    return comment;
  }
}
