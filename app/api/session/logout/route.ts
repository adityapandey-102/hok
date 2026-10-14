import { NextResponse, type NextRequest } from "next/server";
import { getAccessToken, clearSession } from "../../../../lib/session/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../../../../lib/session/constants";

/** Best-effort server-side revoke of the current session (needs the bearer token). */
async function revokeUpstream() {
  const accessToken = await getAccessToken();
  if (!accessToken) return;
  await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL!}/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }).catch(() => {});
}

/** Revokes the session server-side (best-effort) and clears both cookies. */
export async function POST() {
  await revokeUpstream();
  await clearSession();
  return new NextResponse(null, { status: 204 });
}

/**
 * GET variant that clears the cookies and redirects to /login. This is the
 * recovery path for a session the app shell can't validate anymore -- e.g. a
 * token that's revoked server-side (password reset, admin deactivation) but not
 * yet locally expired. A plain `redirect("/login")` from a Server Component
 * can't delete cookies, so proxy.ts would keep seeing the not-yet-expired token
 * as "authenticated" and bounce /login -> /app forever. Deleting the cookies
 * on the redirect response here breaks that loop.
 */
export async function GET(request: NextRequest) {
  await revokeUpstream();
  const loginUrl = new URL("/login", request.url);
  const next = request.nextUrl.searchParams.get("next");
  if (next && next.startsWith("/")) loginUrl.searchParams.set("next", next);

  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}
