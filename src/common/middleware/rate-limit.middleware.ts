import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env";
import { ERROR_CODES } from "../errors/error-codes";
import { ipKey } from "./ip-key";

/** Respond in the API's standard error shape (stable code + requestId) rather than express-rate-limit's default plain-text body. */
const rateLimitedHandler = (req: Request, res: Response) => {
  res.status(429).json({
    error: "Too many attempts. Please wait a while and try again.",
    code: ERROR_CODES.RATE_LIMITED,
    requestId: typeof req.id === "string" ? req.id : undefined,
  });
};

/**
 * Brute-force protection for authentication endpoints only. Deliberately
 * scoped to `/auth/*` -- the rest of the API is behind a bearer token, so the
 * unauthenticated attack surface worth rate-limiting is the credential and
 * token endpoints (login, password reset, refresh, code exchange).
 *
 * In-memory store (express-rate-limit's default). This is a single-process
 * Modular Monolith at ~50 staff, so a per-instance in-memory counter is
 * exactly right -- no Redis, no distributed coordination. Everything is
 * isolated in this one module: swapping to a shared store later (if this ever
 * runs multi-instance) is a one-line `store:` change here, with nothing else
 * in the app touched.
 */
export const authRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-7", // RateLimit-* response headers
  legacyHeaders: false,
  keyGenerator: (req) => ipKey(req.ip), // IPv6 grouped by /64
  handler: rateLimitedHandler,
});

/** Per-email key for login: lower-cased, trimmed body.email; the IP key when there is none. */
export function loginEmailKey(req: Pick<Request, "body" | "ip">): string {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" && email.trim() ? `email:${email.trim().toLowerCase()}` : ipKey(req.ip);
}

/**
 * Extra cap on POST /auth/login per target account, on top of the per-IP
 * authRateLimiter: stops one account being guessed from many IPs (or from
 * behind a rotating IPv6 range). Same window and 429 shape as authRateLimiter.
 */
export const loginEmailRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_LOGIN_EMAIL_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: loginEmailKey,
  handler: rateLimitedHandler,
});
