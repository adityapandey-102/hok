import { Router, type Request } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { uuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { PortalLinksService, type PortalCaller } from "../application/portal-links.service";
import { DrizzlePortalLinksRepository } from "../infrastructure/drizzle-portal.repository";
import { toPortalLinkDto } from "./portal.presenter";

/** Composition root for the Portal module's staff side. */
const service = new PortalLinksService(new DrizzlePortalLinksRepository());

export const portalLinksRouter = Router();

// portal:manage -- the Admin (any client) and SMM / MM (own clients; others' are 404). Task-only staff 403.
portalLinksRouter.use(requireAuth, requireCapability("portal:manage"));
portalLinksRouter.param("clientId", uuidParam(ERROR_CODES.CLIENT_NOT_FOUND, "Client"));

const callerOf = (req: Request): PortalCaller => ({ userId: req.authUserId!, role: req.profile!.role });

/** The client's current link (active, else the latest revoked), or null. Never the token. */
portalLinksRouter.get(
  "/:clientId",
  asyncHandler(async (req, res) => {
    const link = await service.get(callerOf(req), req.params.clientId!);
    res.json({ link: link ? toPortalLinkDto(link) : null });
  }),
);

/** Generate or regenerate: the previous link stops working. The token/url are shown ONCE. */
portalLinksRouter.post(
  "/:clientId",
  asyncHandler(async (req, res) => {
    const { link, token, url } = await service.generate(callerOf(req), req.params.clientId!);
    res.set("Cache-Control", "no-store");
    res.status(201).json({ link: toPortalLinkDto(link), token, url });
  }),
);

/** Disable (idempotent). */
portalLinksRouter.post(
  "/:clientId/disable",
  asyncHandler(async (req, res) => {
    const link = await service.disable(callerOf(req), req.params.clientId!);
    res.json({ link: link ? toPortalLinkDto(link) : null });
  }),
);
