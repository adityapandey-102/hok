import { headers as requestHeaders } from "next/headers";
import { getAccessToken, getRefreshToken, setSession } from "../session/server";
import { isExpired } from "../session/jwt";
import { isRefreshTokenRejected, postRefresh } from "../session/refresh";
import { describeFetchError, logger } from "../logging/logger";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

/**
 * Thrown by apiFetchServer on a non-2xx response, carrying the HTTP `status`
 * so a Server Component can react (e.g. a 404 -> Next's `notFound()` for a
 * clean "not found / no access" page, rather than the whole page crashing).
 */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Refreshes against hok-api (never Supabase) if the current access token is missing or expired. */
async function ensureFreshAccessToken(): Promise<string | null> {
  const token = await getAccessToken();
  if (token && !isExpired(token)) return token;

  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  let response: Response;
  try {
    response = await postRefresh(refreshToken, await requestHeaders());
  } catch {
    throw new ApiError("Service temporarily unavailable. Please try again.", 503);
  }

  // Only a rejected token means no session; 429 / 5xx must not end it (the
  // layout shows an error instead of signing the user out).
  if (isRefreshTokenRejected(response.status)) return null;
  if (!response.ok) throw new ApiError("Service temporarily unavailable. Please try again.", response.status === 429 ? 429 : 503);

  const data = await response.json();
  // Best-effort: throws (and is swallowed) when called from a plain Server
  // Component, which can't set cookies -- the proxy keeps the session fresh
  // in that case instead. See lib/session/server.ts.
  await setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.accessToken;
}

/** Server Component / Server Action fetch wrapper for the Express API. */
export async function apiFetchServer(path: string, init: RequestInit = {}) {
  const token = await ensureFreshAccessToken();

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, cache: "no-store" });
  } catch (err) {
    // Transport failure (e.g. the API is down -> ECONNREFUSED). Surface a
    // friendly message and a 503 so the page can render an error state instead
    // of a raw stack. status 0 would be ambiguous; 503 reads as "unavailable".
    const { message } = describeFetchError(err);
    logger.error("API unreachable from server component", {
      path,
      method: init.method ?? "GET",
      cause: err instanceof Error ? err.message : String(err),
    });
    throw new ApiError(message, 503);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    logger.warn("API request failed (server component)", { path, method: init.method ?? "GET", status: response.status, code: body.code, requestId: body.requestId });
    throw new ApiError(body.error ?? `Request failed: ${response.status}`, response.status);
  }

  if (response.status === 204) return null;
  return response.json();
}
