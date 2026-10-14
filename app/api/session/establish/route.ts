import { NextResponse, type NextRequest } from "next/server";
import { setSession } from "../../../../lib/session/server";

/**
 * Stores a session the client already obtained. Needed only for the implicit
 * (fragment) email-link flow: those tokens arrive in the URL fragment, which
 * only browser JS can read, so the callback page reads them and hands them
 * here to be stored -- the refresh token then lives in an httpOnly cookie it
 * can no longer touch, instead of a JS-readable one.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { accessToken?: string; refreshToken?: string };
  if (!body.accessToken || !body.refreshToken) {
    return NextResponse.json({ error: "Missing tokens" }, { status: 400 });
  }

  await setSession({ accessToken: body.accessToken, refreshToken: body.refreshToken });
  return new NextResponse(null, { status: 204 });
}
