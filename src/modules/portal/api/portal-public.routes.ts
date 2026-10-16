import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateQuery } from "../../../common/http/validate.middleware";
import { requireUuidParam } from "../../../common/http/uuid-param";
import { ERROR_CODES } from "../../../common/errors/error-codes";
import { PortalPublicService } from "../application/portal-public.service";
import { DrizzlePortalReadRepository } from "../infrastructure/drizzle-portal.repository";
import { toPortalDashboard, toPortalEvent, toPortalEventDetail } from "./portal.presenter";

/** Composition root for the Portal module's public side. */
const service = new PortalPublicService(new DrizzlePortalReadRepository());

const instant = z.string().datetime({ offset: true });
const rangeQuery = z.object({ from: instant, to: instant });

/**
 * The client's read-only portal, mounted by app.ts at /api/v1/portal/:token
 * AFTER requirePortalLink (the token is the credential) and the portal read
 * limiter, and BEFORE the global JSON parser (small body limit). `req.portal`
 * is the client the link opens; every read is pinned to it.
 */
export const portalPublicRouter = Router({ mergeParams: true });

const noStore = (_req: unknown, res: { set: (k: string, v: string) => void }, next: () => void) => {
  // Portal data is private to whoever holds the link: never cache it in shared caches.
  res.set("Cache-Control", "private, no-store");
  next();
};
portalPublicRouter.use(noStore);

/** FR-POR-04: the dashboard. */
portalPublicRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(toPortalDashboard(await service.dashboard(req.portal!)));
  }),
);

/** FR-POR-05: the calendar range (required, ≤ 92 days). */
portalPublicRouter.get(
  "/events",
  validateQuery(rangeQuery),
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as unknown as z.infer<typeof rangeQuery>;
    const result = await service.calendar(req.portal!, from, to);
    res.json({ ...result, events: result.events.map(toPortalEvent) });
  }),
);

/** One event with its client-visible updates (FR-POR-06). */
portalPublicRouter.get(
  "/events/:eventId",
  requireUuidParam("eventId", ERROR_CODES.PORTAL_EVENT_NOT_FOUND, "Event"),
  asyncHandler(async (req, res) => {
    res.json({ event: toPortalEventDetail(await service.event(req.portal!, req.params.eventId!)) });
  }),
);
