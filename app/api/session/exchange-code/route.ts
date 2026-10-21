import { NextResponse, type NextRequest } from "next/server";
import { postToAuthApi } from "../../../../lib/session/api-proxy";
import { setSession } from "../../../../lib/session/server";
import { rejectCrossSite } from "../../../../lib/session/same-origin";

/** PKCE code exchange (email links configured for the `?code=` flow), proxied server-side to set the httpOnly refresh cookie. */
export async function POST(request: NextRequest) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const body = (await request.json().catch(() => ({}))) as { code?: string };
  const { status, data } = await postToAuthApi("/auth/exchange-code", { code: body.code }, request);

  if (status !== 200) {
    return NextResponse.json({ error: data.error ?? "Link is invalid or expired", code: data.code }, { status });
  }

  await setSession({ accessToken: String(data.accessToken), refreshToken: String(data.refreshToken) });
  return NextResponse.json({ profile: data.profile });
}
