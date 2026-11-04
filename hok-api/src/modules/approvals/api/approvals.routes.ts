import { Router, type Request } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody, validateQuery } from "../../../common/http/validate.middleware";
import { uuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { auditLogger } from "../../../common/audit/drizzle-audit-logger";
import { approvalDecidedPayload, approvalRequestedPayload, notifier } from "../../notifications/notifications.module";
import { workTreeNotifier } from "../../work-tree/work-tree.module";
import { ApprovalsService, type ApprovalsCaller } from "../application/approvals.service";
import type { ApprovalNotifier } from "../application/ports/approval-notifier.port";
import { DrizzleApprovalsRepository } from "../infrastructure/drizzle-approvals.repository";
import {
  approvalQueryDtoSchema,
  cancelApprovalDtoSchema,
  decideApprovalDtoSchema,
  requestApprovalDtoSchema,
  type ApprovalQueryDto,
  type CancelApprovalDto,
  type DecideApprovalDto,
  type RequestApprovalDto,
} from "./dto/approval.dto";
import { toApprovalResponseDto } from "./approval.presenter";

/** Bell + web push, never email. The dispatcher skips the actor and applies each person's mutes. */
const approvalNotifier: ApprovalNotifier = {
  requested: (n) =>
    notifier.notify({
      type: "approval_requested",
      recipientIds: n.recipientIds,
      actorId: n.actorId,
      payload: approvalRequestedPayload({ subject: n.subject, itemId: n.itemId, itemTitle: n.itemTitle, stageName: n.stageName, approvalId: n.approvalId }),
    }),
  decided: (n) =>
    notifier.notify({
      type: "approval_decided",
      recipientIds: n.recipientIds,
      actorId: n.actorId,
      payload: approvalDecidedPayload({
        subject: n.subject,
        itemId: n.itemId,
        itemTitle: n.itemTitle,
        stageName: n.stageName,
        approvalId: n.approvalId,
        decision: n.decision,
        via: n.via,
      }),
    }),
};

/** Composition root for the Approvals module (shared with the portal route, which makes the client's decision). */
export const approvalsService = new ApprovalsService(new DrizzleApprovalsRepository(), auditLogger, approvalNotifier, workTreeNotifier);

export const approvalsRouter = Router();

// Every staff role reads approvals: the service decides what each person sees (the items they can see) and may do.
approvalsRouter.use(requireAuth, requireCapability("staff_tasks:read"));
approvalsRouter.param("id", uuidParam(ERROR_CODES.STAGE_APPROVAL_NOT_FOUND, "Approval"));

const callerOf = (req: Request): ApprovalsCaller => ({ userId: req.authUserId!, role: req.profile!.role });

/** The inbox. `view=to_decide` (default) = waiting for me; `requested` = I asked; `all_visible` = everything I can see. */
approvalsRouter.get(
  "/",
  validateQuery(approvalQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const result = await approvalsService.list(callerOf(req), req.query as unknown as ApprovalQueryDto);
    res.json({ ...result, approvals: result.approvals.map(toApprovalResponseDto) });
  }),
);

/** The badge and the dashboard. Registered before `/:id` routes (none are GET, but keep the static path first). */
approvalsRouter.get(
  "/count",
  asyncHandler(async (req, res) => {
    res.json(await approvalsService.count(callerOf(req)));
  }),
);

/** Anyone who may MOVE the item asks for approval of its current stage. */
approvalsRouter.post(
  "/",
  validateBody(requestApprovalDtoSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json({ approval: toApprovalResponseDto(await approvalsService.request(callerOf(req), req.body as RequestApprovalDto)) });
  }),
);

/** Any one eligible approver approves, or requests changes (with a comment). */
approvalsRouter.post(
  "/:id/decision",
  validateBody(decideApprovalDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ approval: toApprovalResponseDto(await approvalsService.decide(callerOf(req), req.params.id!, req.body as DecideApprovalDto)) });
  }),
);

/** The requester, or whoever manages the item, withdraws a waiting request. */
approvalsRouter.post(
  "/:id/cancel",
  validateBody(cancelApprovalDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ approval: toApprovalResponseDto(await approvalsService.cancel(callerOf(req), req.params.id!, req.body as CancelApprovalDto)) });
  }),
);
