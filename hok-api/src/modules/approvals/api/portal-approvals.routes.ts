import { Router } from "express";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody } from "../../../common/http/validate.middleware";
import { requireUuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { portalCommentLimiters } from "../../../common/middleware/portal-rate-limit.middleware";
import { decideApprovalDtoSchema, type DecideApprovalDto } from "./dto/approval.dto";
import { approvalsService } from "./approvals.routes";

/**
 * The client's decision (round 3). Mounted by app.ts at /api/v1/portal/:token AFTER requirePortalLink (req.portal
 * is the client the link opens) and the small JSON parser (4 kb), exactly like the portal comments: the SAME
 * rate limiters, so approvals can't be used to flood a team. Every "no" -- another client's approval, a
 * staff-only stage, an already-decided one, a made-up id -- is the same 404 PORTAL_APPROVAL_NOT_FOUND.
 */
export const portalApprovalsRouter = Router({ mergeParams: true });

portalApprovalsRouter.post(
  "/approvals/:approvalId",
  ...portalCommentLimiters,
  requireUuidParam("approvalId", ERROR_CODES.PORTAL_APPROVAL_NOT_FOUND, "Approval"),
  validateBody(decideApprovalDtoSchema),
  asyncHandler(async (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(await approvalsService.decideFromPortal(req.portal!, req.params.approvalId!, req.body as DecideApprovalDto));
  }),
);
