"use client";

import { ACCESS_TOKEN_COOKIE } from "./constants";

/**
 * Browser-side session access. Only the access token is readable here -- it's
 * a non-httpOnly cookie so lib/api/client can attach it to direct API calls.
 * The refresh token is an httpOnly cookie the browser JS cannot read or
 * write; every operation that establishes, rotates, or clears a session goes
 * through the same-origin `/api/session/*` route handlers instead (see
 * modules/auth/api/authApi and lib/api/client's refresh path).
 */
export function getAccessToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${ACCESS_TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}
