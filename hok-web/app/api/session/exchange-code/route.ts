import { NextResponse } from "next/server";

/**
 * Turned off with the email-link flow (owner decision, security audit run 1). The
 * callback page that used it is off too; re-enable both together with a
 * browser-bound, single-use code once HOK has an email service.
 */
export function POST() {
  return NextResponse.json({ error: "Sign-in links are not available", code: "AUTH_LINKS_DISABLED" }, { status: 404 });
}
