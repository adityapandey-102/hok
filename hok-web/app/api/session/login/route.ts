import { NextResponse, type NextRequest } from "next/server";
import { postToAuthApi } from "../../../../lib/session/api-proxy";
import { setSession } from "../../../../lib/session/server";
import { rejectCrossSite } from "../../../../lib/session/same-origin";
import { COOKIE_MAX_AGE_DEVICE, DEVICE_COOKIE } from "../../../../lib/session/constants";

/**
 * Same-origin login. Proxies credentials to hok-api server-side so the
 * refresh token is stored in an httpOnly cookie the browser can never read.
 * Returns only the profile -- the tokens live in cookies, not the response body.
 * Also keeps hok-api's trusted-device token in an httpOnly cookie and sends it on
 * the next login, so a stranger's failed guesses can't lock this browser out.
 */
export async function POST(request: NextRequest) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const deviceToken = request.cookies.get(DEVICE_COOKIE)?.value;
  const { status, data } = await postToAuthApi("/auth/login", { email: body.email, password: body.password, deviceToken }, request);

  if (status !== 200) {
    return NextResponse.json({ error: data.error ?? "Login failed", code: data.code }, { status });
  }

  await setSession({ accessToken: String(data.accessToken), refreshToken: String(data.refreshToken) });
  const response = NextResponse.json({ profile: data.profile });
  if (typeof data.deviceToken === "string") {
    response.cookies.set(DEVICE_COOKIE, data.deviceToken, {
      path: "/api/session/login",
      maxAge: COOKIE_MAX_AGE_DEVICE,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}
