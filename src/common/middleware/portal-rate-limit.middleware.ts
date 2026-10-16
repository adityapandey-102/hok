import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { env } from "../../config/env";
import { ERROR_CODES } from "../errors/error-codes";

/**
 * Limits for the public client portal (FR-CMT-08), needleye's public-form
 * pattern: in-memory (one process), standard error shape, keyed on the real
 * client IP (TRUST_PROXY). Reads are generous; comment posts are tight per
 * IP, capped for everyone together, and capped per link so one leaked link
 * can't flood a manager's inbox.
 */
function limiter(windowMs: number, limit: number, message: string, keyGenerator?: (req: Request) => string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (req: Request, res: Response) => {
      res.status(429).json({ error: message, code: ERROR_CODES.RATE_LIMITED, requestId: typeof req.id === "string" ? req.id : undefined });
    },
  });
}

const HOUR = 60 * 60 * 1000;

export const portalReadLimiter = limiter(15 * 60 * 1000, env.PORTAL_READ_RATE_LIMIT_MAX, "Too many requests. Please wait a few minutes and try again.");

export const portalCommentLimiters = [
  limiter(HOUR, env.PORTAL_COMMENT_RATE_LIMIT_MAX, "You've sent a lot of comments. Please try again in a while."),
  limiter(HOUR, env.PORTAL_COMMENT_GLOBAL_MAX_PER_HOUR, "Comments are busy right now. Please try again later.", () => "everyone"),
  // Per link (the resolved link id, never the token), after requirePortalLink has run.
  limiter(24 * HOUR, env.PORTAL_COMMENT_MAX_PER_LINK_PER_DAY, "This link has reached today's comment limit. Please try again tomorrow.", (req) => `link:${req.portal?.linkId ?? "none"}`),
];
