import type { NextRequest } from "next/server";
import { forwardedClientHeaders } from "./forwarded";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

/**
 * Server-side call to hok-api's /auth/* endpoints, used by the
 * app/api/session/* route handlers that own the (httpOnly) session cookies.
 *
 * The client's IP is forwarded (forwarded.ts) so hok-api's auth rate limiter
 * keys on the real end user, not on the Next.js server -- without this, every
 * login in production would share one rate-limit bucket (the web host's IP).
 */
export async function postToAuthApi(
  path: string,
  body: unknown,
  request: NextRequest,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...forwardedClientHeaders(request.headers) };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, data };
}

