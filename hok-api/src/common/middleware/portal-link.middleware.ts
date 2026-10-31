import type { NextFunction, Request, Response } from "express";
import { hashToken } from "../crypto/credentials";
import { findActivePortalLink, touchPortalLink, type PortalContext } from "../database/portal-links";
import { asyncHandler } from "../http/async-handler";
import { NotFoundError } from "../errors/app-error";
import { ERROR_CODES } from "../errors/error-codes";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by requirePortalLink on /api/v1/portal/:token/* -- the client this link opens. */
      portal?: PortalContext;
    }
  }
}

/** generateOpaqueToken(): 32 random bytes, base64url, no padding = 43 characters. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/**
 * The client portal's "authentication": the link token in the path IS the
 * credential (FR-POR-03, link only). A malformed token is refused before
 * any query; a well-formed one is hashed and looked up by hash (the database
 * never holds the token). Unknown, regenerated, disabled and archived-client
 * links all get the SAME 404, so nothing can be learned by probing.
 */
export const requirePortalLink = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.params.token ?? "";
  const portal = TOKEN_SHAPE.test(token) ? await findActivePortalLink(hashToken(token)) : null;
  if (!portal) throw new NotFoundError("This link isn't valid any more. Ask your account manager for a new one.", ERROR_CODES.PORTAL_LINK_INVALID);
  req.portal = portal;
  // Best-effort bookkeeping; never blocks or fails the request.
  touchPortalLink(portal.linkId).catch((err: unknown) => req.log.warn({ err }, "Could not record portal link use"));
  next();
});
