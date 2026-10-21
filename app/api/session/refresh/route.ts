import { NextResponse, type NextRequest } from "next/server";
import { postToAuthApi } from "../../../../lib/session/api-proxy";
import { getRefreshToken, setSession } from "../../../../lib/session/server";
import { rejectCrossSite } from "../../../../lib/session/same-origin";

/**
 * Rotates the session from the httpOnly refresh cookie -- the browser calls
 * this (same-origin) when its access token is stale, never touching the
 * refresh token itself. Returns the new access token so the caller can use it
 * immediately; the Set-Cookie also updates the readable access cookie.
 */
export async function POST(request: NextRequest) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const { status, data } = await postToAuthApi("/auth/refresh", { refreshToken }, request);
  if (status !== 200) {
    // Cookies are NOT cleared here: this may be a losing race with another tab's (or
    // the proxy's) successful rotation, and clearing would wipe the fresh session.
    // A session that's really dead is cleared by the proxy on the next navigation.
    return NextResponse.json({ error: data.error ?? "Session expired", code: data.code }, { status: 401 });
  }

  await setSession({ accessToken: String(data.accessToken), refreshToken: String(data.refreshToken) });
  return NextResponse.json({ accessToken: data.accessToken });
}
