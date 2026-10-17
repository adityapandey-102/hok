import { Router, type Request } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody, validateQuery } from "../../../common/http/validate.middleware";
import { uuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { auditLogger } from "../../../common/audit/drizzle-audit-logger";
import { portalCommentLimiters } from "../../../common/middleware/portal-rate-limit.middleware";
import { clientCommentPayload, notifier } from "../../notifications/notifications.module";
import { ClientCommentsService, type CommentsCaller } from "../application/client-comments.service";
import type { CommentNotifier } from "../application/ports/comment-notifier.port";
import { excerpt } from "../domain/client-comment.rules";
import { DrizzleClientCommentsRepository } from "../infrastructure/drizzle-client-comments.repository";
import { toCommentDto, toPortalCommentDto } from "./client-comment.presenter";
import {
  commentQueryDtoSchema,
  portalCommentQueryDtoSchema,
  postCommentDtoSchema,
  updateCommentDtoSchema,
  type CommentQueryDto,
  type PostCommentDto,
  type UpdateCommentDto,
} from "./dto/client-comment.dto";

/** M9 hook: a new portal comment → bell + web push to the client's owning manager only (decision D6). */
const commentNotifier: CommentNotifier = {
  newClientComment: (n) =>
    notifier.notify({
      type: "client_comment",
      recipientIds: [n.ownerId],
      actorId: null, // the client (no staff account)
      payload: clientCommentPayload({
        clientId: n.clientId,
        clientName: n.clientName,
        commentId: n.commentId,
        url: `/app/comments?commentId=${n.commentId}`,
        excerpt: excerpt(n.body),
      }),
    }),
};

/** Composition root for the Client-comments module. */
const service = new ClientCommentsService(new DrizzleClientCommentsRepository(), commentNotifier, auditLogger);

const callerOf = (req: Request): CommentsCaller => ({ userId: req.authUserId!, role: req.profile!.role });

// -- Staff inbox: /api/v1/client-comments -------------------------------------
export const clientCommentsRouter = Router();
clientCommentsRouter.use(requireAuth);
clientCommentsRouter.param("commentId", uuidParam(ERROR_CODES.COMMENT_NOT_FOUND, "Comment"));

/** FR-CMT-06: the inbox (default: open comments), newest first, paginated. */
clientCommentsRouter.get(
  "/",
  requireCapability("comments:read"),
  validateQuery(commentQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as CommentQueryDto;
    const { comments, total } = await service.list(callerOf(req), q);
    res.json({ comments: comments.map(toCommentDto), total, limit: q.limit, offset: q.offset });
  }),
);

/** The badge: open comments by status, scoped. */
clientCommentsRouter.get(
  "/counts",
  requireCapability("comments:read"),
  asyncHandler(async (req, res) => {
    res.json(await service.counts(callerOf(req)));
  }),
);

clientCommentsRouter.get(
  "/:commentId",
  requireCapability("comments:read"),
  asyncHandler(async (req, res) => {
    res.json({ comment: toCommentDto(await service.get(callerOf(req), req.params.commentId!)) });
  }),
);

/** FR-CMT-03/04: status and/or reply, with the version. */
clientCommentsRouter.patch(
  "/:commentId",
  requireCapability("comments:manage"),
  validateBody(updateCommentDtoSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as UpdateCommentDto;
    res.json({ comment: toCommentDto(await service.update(callerOf(req), req.params.commentId!, body)) });
  }),
);

// -- Public portal: /api/v1/portal/:token/comments ----------------------------
// Mounted by app.ts after requirePortalLink (req.portal is set) and the small JSON parser.
export const portalCommentsRouter = Router({ mergeParams: true });

/** FR-CMT-05: the client's own comments with status and reply. */
portalCommentsRouter.get(
  "/comments",
  validateQuery(portalCommentQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as { limit: number; offset: number };
    res.set("Cache-Control", "private, no-store");
    const { comments, total } = await service.listForPortal(req.portal!, q.limit, q.offset);
    res.json({ comments: comments.map(toPortalCommentDto), total, limit: q.limit, offset: q.offset });
  }),
);

/** FR-CMT-01/08: post a comment; rate-limited per IP, overall and per link. */
portalCommentsRouter.post(
  "/comments",
  ...portalCommentLimiters,
  validateBody(postCommentDtoSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as PostCommentDto;
    res.set("Cache-Control", "no-store");
    res.status(201).json({ comment: toPortalCommentDto(await service.post(req.portal!, body)) });
  }),
);
