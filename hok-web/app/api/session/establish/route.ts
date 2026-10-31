import { NextResponse } from "next/server";

/**
 * Turned off with the email-link flow (owner decision, security audit run 1): it stored
 * any token pair it was given as the session, so a crafted link could swap a signed-in
 * person into another account. Re-enable only with a browser-bound, single-use code.
 */
export function POST() {
  return NextResponse.json({ error: "Sign-in links are not available", code: "AUTH_LINKS_DISABLED" }, { status: 404 });
}
