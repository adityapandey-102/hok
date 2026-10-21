import { NextResponse } from "next/server";

/**
 * CSRF guard for the cookie-setting session routes (login, establish,
 * exchange-code, refresh, logout). Another site can make a browser POST here
 * with a plain HTML form (text/plain or form-encoded body), and the response
 * would set or clear THIS site's session cookies: e.g. silently signing the
 * victim in as the attacker (login CSRF, review 2026-10-22). So:
 *  - the body must be declared JSON: a form can't send that, and a
 *    cross-site fetch() that does needs a CORS preflight these routes never
 *    grant;
 *  - when the browser says where the request came from (Sec-Fetch-Site, all
 *    current browsers), it must be this same origin.
 * Returns a 403 response to send back, or null when the request may go on.
 */
export function rejectCrossSite(request: Request): NextResponse | null {
  const type = request.headers.get("content-type")?.toLowerCase() ?? "";
  const site = request.headers.get("sec-fetch-site");
  if (!type.startsWith("application/json") || (site !== null && site !== "same-origin")) {
    return NextResponse.json({ error: "This request must come from the HOK app itself." }, { status: 403 });
  }
  return null;
}
