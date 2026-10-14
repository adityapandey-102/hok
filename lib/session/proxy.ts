import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  COOKIE_MAX_AGE_ACCESS,
  COOKIE_MAX_AGE_REFRESH,
} from "./constants";
import { isExpired } from "./jwt";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

/** Where a signed-in staff member lands. */
export const APP_HOME = "/app";

/**
 * The only area that needs a session: the staff app. Everything else on this
 * site is public -- the portfolio (`/`, `/about`, …), the client portal
 * (`/p/<token>`, which carries its own link token) and the sign-in pages.
 * This is the inverse of needleye (which protects everything except a list),
 * because here the public website is the default. docs/ARCHITECTURE.md §11.
 */
function isProtectedPath(pathname: string): boolean {
  return pathname === APP_HOME || pathname.startsWith(`${APP_HOME}/`);
}

/**
 * Sign-in pages where an *existing* session should bounce the user onward to
 * the app instead of showing the page (e.g. an already signed-in user hitting
 * /login). /update-password is intentionally NOT here: it's reached right
 * after the reset-password email link is exchanged for a session via
 * /auth/callback, so a present session there must render normally.
 */
const SIGN_IN_PATHS = ["/login", "/setup", "/reset-password", "/auth/callback"];

type Tokens = { accessToken: string; refreshToken: string };

/**
 * Refreshes the session cookies (against hok-api, never Supabase directly) on
 * every request it runs for, redirects signed-out users away from /app, and
 * bounces signed-in users off the sign-in pages. Named for Next.js 16's
 * proxy.ts convention (formerly middleware.ts) -- see root proxy.ts.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = isProtectedPath(pathname);
  const isSignInPath = SIGN_IN_PATHS.some((path) => pathname.startsWith(path));

  let accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
  let refreshedTokens: Tokens | null = null;

  if ((!accessToken || isExpired(accessToken)) && refreshToken) {
    refreshedTokens = await refreshSession(refreshToken);
    accessToken = refreshedTokens?.accessToken ?? null;
  }

  const authenticated = Boolean(accessToken && !isExpired(accessToken));

  if (!authenticated && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
    return response;
  }

  if (authenticated && isSignInPath) {
    return applyTokens(NextResponse.redirect(new URL(APP_HOME, request.url)), refreshedTokens);
  }

  return applyTokens(NextResponse.next({ request }), refreshedTokens);
}

async function refreshSession(refreshToken: string): Promise<Tokens | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return null;

    const data = await response.json();
    return { accessToken: data.accessToken, refreshToken: data.refreshToken };
  } catch {
    return null;
  }
}

function applyTokens(response: NextResponse, tokens: Tokens | null) {
  if (!tokens) return response;

  const secure = process.env.NODE_ENV === "production";
  // Access token stays readable by browser JS (Bearer header on direct API
  // calls); refresh token is httpOnly so JS can never read it. Mirrors the
  // cookie flags in lib/session/server.ts.
  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    path: "/",
    maxAge: COOKIE_MAX_AGE_ACCESS,
    httpOnly: false,
    sameSite: "lax",
    secure,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    path: "/",
    maxAge: COOKIE_MAX_AGE_REFRESH,
    httpOnly: true,
    sameSite: "lax",
    secure,
  });
  return response;
}
