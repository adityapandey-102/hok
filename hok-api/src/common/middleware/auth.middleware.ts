import type { Request, Response, NextFunction } from "express";
import type { Profile } from "../../domain";
import { authProvider } from "../auth/supabase-auth-provider";
import { fetchActiveProfile } from "../database/profiles";
import { touchLastSeen } from "../database/last-seen";
import { asyncHandler } from "../http/async-handler";
import { UnauthorizedError } from "../errors/app-error";
import { ERROR_CODES } from "../errors/error-codes";
import { setRequestUser } from "../context/request-context";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUserId?: string;
      accessToken?: string;
      profile?: Profile;
    }
  }
}

/** Real Supabase access tokens are ~1 KB; anything far larger is junk. */
const MAX_TOKEN_LENGTH = 4096;

/**
 * Shape-only pre-check (signature is still verified by Supabase Auth): three base64url parts and a
 * payload whose `exp` is in the future.
 */
export function isUnexpiredJwt(token: string, nowSeconds = Date.now() / 1000): boolean {
  if (token.length > MAX_TOKEN_LENGTH) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) return false;
  try {
    const exp: unknown = (JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as { exp?: unknown } | null)?.exp;
    return typeof exp === "number" && exp > nowSeconds;
  } catch {
    return false;
  }
}

/**
 * Verifies the bearer token via AuthProvider, then loads the matching
 * `profiles` row (role, active) via Drizzle. `profiles.role` is the
 * authorization source of truth -- not client-writable JWT metadata.
 * Nothing here is stored between requests: every call re-verifies the token
 * it was given, which is what keeps the API stateless. Never touches the
 * Supabase SDK directly -- that's entirely inside SupabaseAuthProvider.
 */
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.header("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!token) throw new UnauthorizedError("Missing bearer token", ERROR_CODES.AUTH_TOKEN_MISSING);
  // Cheap local check first: junk or expired tokens never cost a round trip to Supabase Auth.
  if (!isUnexpiredJwt(token)) throw new UnauthorizedError("Invalid or expired session", ERROR_CODES.AUTH_SESSION_INVALID);

  const verified = await authProvider.verifyAccessToken(token);
  if (!verified) throw new UnauthorizedError("Invalid or expired session", ERROR_CODES.AUTH_SESSION_INVALID);

  req.authUserId = verified.userId;
  req.accessToken = token;
  req.profile = await fetchActiveProfile(verified.userId);
  // "Last seen" for the team pages and reports; throttled, never awaited.
  touchLastSeen(req.profile.id);

  // Make the authenticated identity available to request-scoped consumers
  // that don't have `req` (audit logger, slow-query logger).
  setRequestUser(req.profile.id, req.profile.role);

  next();
});
