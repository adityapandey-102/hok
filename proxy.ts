import type { NextRequest } from "next/server";
import { updateSession } from "./lib/session/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Only the staff app and the sign-in pages need the session proxy. The
     * public portfolio (`/`, `/about`, …) and the client portal (`/p/...`)
     * never run it, so a website visitor never triggers a token refresh. The
     * /api/* route handlers own the session cookies themselves (see
     * app/api/session/*) and must not be intercepted either.
     */
    "/app",
    "/app/:path*",
    "/login",
    "/setup",
    "/reset-password",
    "/update-password",
    "/auth/callback",
  ],
};
