import { cookies } from "next/headers";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  COOKIE_MAX_AGE_ACCESS,
  COOKIE_MAX_AGE_REFRESH,
} from "./constants";

/** Server Component / Server Action / Route Handler session cookie access. */

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_TOKEN_COOKIE)?.value ?? null;
}

export async function setSession(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
  const store = await cookies();
  const secure = process.env.NODE_ENV === "production";
  try {
    // Access token: readable by browser JS (httpOnly: false) so lib/api/client
    // can attach it as a Bearer header on direct calls to hok-api.
    store.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      path: "/",
      maxAge: COOKIE_MAX_AGE_ACCESS,
      httpOnly: false,
      sameSite: "lax",
      secure,
    });
    // Refresh token: httpOnly -- browser JS can never read it, so an XSS can't
    // steal the long-lived token. Only server code (these session route
    // handlers and the proxy) ever sees it; it's used solely to mint fresh
    // access tokens.
    store.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      path: "/",
      maxAge: COOKIE_MAX_AGE_REFRESH,
      httpOnly: true,
      sameSite: "lax",
      secure,
    });
  } catch {
    // Called from a plain Server Component -- cookies() is read-only there.
    // The proxy is responsible for refreshing the session in that case.
  }
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  try {
    store.delete(ACCESS_TOKEN_COOKIE);
    store.delete(REFRESH_TOKEN_COOKIE);
  } catch {
    // Same read-only-context caveat as setSession.
  }
}
