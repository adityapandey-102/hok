import { NextResponse, type NextRequest } from "next/server";
import { postToAuthApi } from "../../../../lib/session/api-proxy";
import { setSession } from "../../../../lib/session/server";
import { rejectCrossSite } from "../../../../lib/session/same-origin";

/**
 * Same-origin login. Proxies credentials to hok-api server-side so the
 * refresh token is stored in an httpOnly cookie the browser can never read.
 * Returns only the profile -- the tokens live in cookies, not the response body.
 */
export async function POST(request: NextRequest) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const { status, data } = await postToAuthApi("/auth/login", { email: body.email, password: body.password }, request);

  if (status !== 200) {
    return NextResponse.json({ error: data.error ?? "Login failed", code: data.code }, { status });
  }

  await setSession({ accessToken: String(data.accessToken), refreshToken: String(data.refreshToken) });
  return NextResponse.json({ profile: data.profile });
}
