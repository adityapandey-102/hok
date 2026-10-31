import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env";
import { ERROR_CODES } from "../errors/error-codes";
import { isTrustedDevice } from "../auth/trusted-device";
import { clientIp } from "./client-ip";
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
  keyGenerator: (req) => ipKey(clientIp(req)), // IPv6 grouped by /64
  handler: rateLimitedHandler,
});

/** Longest valid email address (RFC 5321); anything longer is not used as a key. */
const MAX_EMAIL_LENGTH = 254;

/** Per-email key: lower-cased, trimmed body.email; the IP key when there is none (or it is oversized junk). */
export function loginEmailKey(req: Pick<Request, "body" | "ip" | "header">): string {
  const email: unknown = (req.body as { email?: unknown } | undefined)?.email;
  const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
  return normalized && normalized.length <= MAX_EMAIL_LENGTH ? `email:${normalized}` : ipKey(clientIp(req));
}

/**
 * POST /auth/login, per (IP, email): the tight cap. One source guessing one account is stopped
 * after a few failures, without touching that account's sign-ins from anywhere else.
 * Successful logins don't count.
 */
export const loginIpEmailRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_LOGIN_IP_EMAIL_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKey(clientIp(req))}|${loginEmailKey(req)}`,
  skipSuccessfulRequests: true,
  handler: rateLimitedHandler,
});

/**
 * POST /auth/login, per email across all IPs: the looser backstop against guessing one account from
 * many IPs (or a rotating IPv6 range). Only failures count, and a browser that has signed in to this
 * account before (valid trusted-device token, common/auth/trusted-device.ts) skips it -- so a
 * stranger can't use it to lock the real owner out.
 */
export const loginEmailRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_LOGIN_EMAIL_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: loginEmailKey,
  skipSuccessfulRequests: true,
  skip: (req) => {
    const body = req.body as { email?: unknown; deviceToken?: unknown } | undefined;
    return isTrustedDevice(body?.deviceToken, body?.email);
  },
  handler: rateLimitedHandler,
});

/**
 * POST /auth/password-reset-request, per target email across all IPs: each accepted request makes
 * Supabase send that address an email, so without this one person's inbox (and the project's mail
 * quota) could be flooded from many IPs. Every request counts (the response is always 204).
 */
export const resetEmailRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.AUTH_RESET_EMAIL_MAX_PER_HOUR,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: loginEmailKey,
  handler: rateLimitedHandler,
});

/**
 * Every authenticated route, per IP: counts only requests answered 401. Each junk bearer token costs
 * a round trip to Supabase Auth, so a client sending many of them is cut off; signed-in users never
 * hit it. Mounted in front of the /api/v1 routers (app.ts).
 */
export const tokenFailureRateLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_TOKEN_FAILURE_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => ipKey(clientIp(req)),
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.statusCode !== 401,
  handler: rateLimitedHandler,
});

/**
 * Push subscribe and "send a test", per signed-in user (mounted after requireAuth): each test fans
 * out to the user's devices through the browsers' push services, so it must not be callable in a loop.
 */
export const pushWriteRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.authUserId ?? ipKey(clientIp(req))}`,
  handler: rateLimitedHandler,
});
