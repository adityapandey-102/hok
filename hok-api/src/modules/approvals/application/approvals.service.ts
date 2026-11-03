import { NotFoundError } from "../../../common/errors/app-error";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import { auditLogger as defaultAuditLogger } from "../../../common/audit/drizzle-audit-logger";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import type { PortalContext } from "../../../common/database/portal-links";
import { approvalFromRow, type Approval, type ApprovalRow, type Role } from "../../../domain";
import {
  assertApprovalVersion,
  assertApprovalVisible,
  assertCanCancel,
  assertCanDecide,
  assertCanRequest,
  assertDecisionComment,
  assertPending,
} from "../domain/approval.rules";
import type { ApprovalsRepositoryPort, ApprovalWrite } from "./ports/approvals-repository.port";
import { noopApprovalNotifier, type ApprovalNotifier } from "./ports/approval-notifier.port";
import type { ApprovalQueryDto, CancelApprovalDto, DecideApprovalDto, RequestApprovalDto } from "../api/dto/approval.dto";

export interface ApprovalsCaller {
  userId: string;
  role: Role;
}

export interface ApprovalListResult {
  approvals: Approval[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Stage approvals (round 3). The route checks the capability (every staff role reads); this service enforces the rest
 * on the locked rows: the item must be visible (else a 404), a request needs the right to MOVE the item, a decision
 * needs a matching approver token and not one's own request (the Admin excepted), a cancel the requester or a manager.
 * The move gate itself lives in the Events and Staff-tasks services (same shared rules), inside their move transactions.
 *
 * Notifications go out after the commit (bell + web push); audit entries carry ids and counts, never notes or comments.
 */
export class ApprovalsService {
  constructor(
    private readonly repo: ApprovalsRepositoryPort,
    private readonly audit: AuditLogger = defaultAuditLogger,
    private readonly notifier: ApprovalNotifier = noopApprovalNotifier,
  ) {}

  // -- reading ------------------------------------------------------------------

  /** The inbox. `to_decide` = pending ones this caller may decide, worked out in SQL (never filtered after paging). */
  async list(caller: ApprovalsCaller, query: ApprovalQueryDto): Promise<ApprovalListResult> {
    const filters = { view: query.view, status: query.view === "to_decide" ? undefined : query.status };
    const [rows, total] = await Promise.all([
      this.repo.list(caller.userId, caller.role, filters, query.limit, query.offset),
      this.repo.count(caller.userId, caller.role, filters),
    ]);
    return { approvals: rows.map((r) => approvalFromRow(r, caller)), total, limit: query.limit, offset: query.offset };
  }

  /** The badge and the dashboard: how many are waiting for this caller. One query. */
  async count(caller: ApprovalsCaller): Promise<{ toDecide: number }> {
    return { toDecide: await this.repo.count(caller.userId, caller.role, { view: "to_decide" }) };
  }

  // -- requesting ---------------------------------------------------------------

  /** Asks for approval of the item's current stage (the item stays where it is). */
  async request(caller: ApprovalsCaller, dto: RequestApprovalDto): Promise<Approval> {
    const seen: { title?: string; stage?: string } = {};
    const id = await this.repo.request(
      { subject: dto.subject, itemId: dto.subjectId, note: dto.note ?? null, link: dto.link ?? null, requestedBy: caller.userId },
      (item) => {
        const usable = assertCanRequest(caller, item, dto.subject);
        seen.title = usable.title;
        seen.stage = usable.stageName;
      },
    );
    await this.audit.record({
      action: AUDIT_ACTIONS.APPROVAL_REQUESTED,
      entityType: AUDIT_ENTITIES.STAGE_APPROVAL,
      entityId: id,
      metadata: { subject: dto.subject, subjectId: dto.subjectId },
    });
    await this.notifyRequested(id, dto.subject, dto.subjectId, seen.title ?? "", seen.stage ?? "", caller.userId);
    return this.respond(caller, id);
  }

  // -- deciding -----------------------------------------------------------------

  /** Any ONE eligible approver approves or requests changes (changes need a comment). */
  async decide(caller: ApprovalsCaller, id: string, dto: DecideApprovalDto): Promise<Approval> {
    const seen: { row?: ApprovalRow } = {};
    await this.repo.transition(id, null, (row): ApprovalWrite => {
      // Visibility first (404), then who may decide (403), then the state of the request (409).
      const visible = assertApprovalVisible(caller, row);
      assertCanDecide(caller, visible.record.approvers, { teamIds: visible.teamIds, canSeeItem: true, requestedBy: visible.record.requestedById });
      assertPending(visible.record.status);
      const comment = assertDecisionComment(dto.decision, dto.comment);
      assertApprovalVersion(visible.record.version, dto.version);
      seen.row = visible;
      return { status: dto.decision === "approve" ? "approved" : "changes_requested", decidedBy: caller.userId, decidedVia: "staff", comment, stampTime: true };
    });
    await this.audit.record({
      action: AUDIT_ACTIONS.APPROVAL_DECIDED,
      entityType: AUDIT_ENTITIES.STAGE_APPROVAL,
      entityId: id,
      metadata: { decision: dto.decision, subject: seen.row?.record.subject, subjectId: seen.row?.record.subjectId },
    });
    if (seen.row) await this.notifyDecided(seen.row, dto.decision, "staff", caller.userId);
    return this.respond(caller, id);
  }

  /** The requester, or whoever manages the item, withdraws a waiting request. */
  async cancel(caller: ApprovalsCaller, id: string, dto: CancelApprovalDto): Promise<Approval> {
    await this.repo.transition(id, null, (row): ApprovalWrite => {
      const visible = assertApprovalVisible(caller, row);
      assertCanCancel(caller, visible);
      assertPending(visible.record.status);
      assertApprovalVersion(visible.record.version, dto.version);
      return { status: "cancelled", decidedBy: null, decidedVia: null, comment: null, stampTime: false };
    });
    await this.audit.record({ action: AUDIT_ACTIONS.APPROVAL_CANCELLED, entityType: AUDIT_ENTITIES.STAGE_APPROVAL, entityId: id });
    return this.respond(caller, id);
  }

  // -- the client, from the portal --------------------------------------------------

  /**
   * The client approves or asks for changes (no login: the link is the credential, `ctx` is what it opens). The
   * approval must be a waiting one on an event of THIS client whose stage lists the client as an approver; every
   * other case -- another client's, a staff-only stage, already decided, made up -- is the same 404.
   */
  async decideFromPortal(ctx: PortalContext, id: string, dto: DecideApprovalDto): Promise<{ ok: true }> {
    const seen: { row?: ApprovalRow } = {};
    await this.repo.transition(id, ctx.clientId, (row): ApprovalWrite => {
      if (!row || row.record.subject !== "event" || !row.record.approvers.includes("client") || row.record.status !== "pending") {
        throw new NotFoundError("This request isn't available any more.", ERROR_CODES.PORTAL_APPROVAL_NOT_FOUND);
      }
      const comment = assertDecisionComment(dto.decision, dto.comment);
      assertApprovalVersion(row.record.version, dto.version);
      seen.row = row;
      return { status: dto.decision === "approve" ? "approved" : "changes_requested", decidedBy: null, decidedVia: "portal", comment, stampTime: true };
    });
    // Actor null (the context has no staff user); the link id says which link did it.
    await this.audit.record({
      action: AUDIT_ACTIONS.APPROVAL_DECIDED,
      entityType: AUDIT_ENTITIES.STAGE_APPROVAL,
      entityId: id,
      metadata: { decision: dto.decision, via: "portal", linkId: ctx.linkId },
    });
    if (seen.row) await this.notifyDecided(seen.row, dto.decision, "portal", null);
    return { ok: true };
  }

  // -- helpers ------------------------------------------------------------------

  private async respond(caller: ApprovalsCaller, id: string): Promise<Approval> {
    const row = await this.repo.findRow(id);
    if (!row) throw new NotFoundError("Approval not found", ERROR_CODES.STAGE_APPROVAL_NOT_FOUND);
    return approvalFromRow(row, caller);
  }

  /** Everyone who could decide it (one query, capped), never the requester. Best-effort: a failure here never fails the request. */
  private async notifyRequested(id: string, subject: "event" | "task", itemId: string, itemTitle: string, stageName: string, actorId: string): Promise<void> {
    try {
      const recipientIds = (await this.repo.deciderIds(id)).filter((r) => r !== actorId);
      if (recipientIds.length === 0) return;
      await this.notifier.requested({ approvalId: id, subject, itemId, itemTitle, stageName, recipientIds, actorId });
    } catch {
      // The notifier already logs; a lookup failure must not undo a committed request.
    }
  }

  /** The requester, plus the task's assignee and creator, or the event's team. The dispatcher skips the actor. */
  private async notifyDecided(row: ApprovalRow, decision: "approve" | "changes", via: "staff" | "portal", actorId: string | null): Promise<void> {
    try {
      const r = row.record;
      const people = r.subject === "event" ? await this.repo.eventNotifiedTeam(r.subjectId) : [row.assigneeId, row.assignedBy];
      const recipientIds = [...new Set([r.requestedById, ...people].filter((p): p is string => typeof p === "string"))];
      await this.notifier.decided({
        approvalId: r.id,
        subject: r.subject,
        itemId: r.subjectId,
        itemTitle: r.subjectTitle,
        stageName: r.stageName,
        decision,
        via,
        recipientIds,
        actorId,
      });
    } catch {
      // Best-effort, as above.
    }
  }
}
