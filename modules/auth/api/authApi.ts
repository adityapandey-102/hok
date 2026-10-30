import { apiFetch } from "../../../lib/api/client";
import type { Profile } from "../../../lib/domain";

export interface BootstrapPayload {
  /** The server's BOOTSTRAP_TOKEN: proves the person setting up owns this deployment. */
  setupKey: string;
  email: string;
  password: string;
  fullName: string;
}

/**
 * POST to a same-origin `/api/session/*` route handler. These routes own the
 * session cookies (the refresh token is httpOnly, so only server code can set
 * it) and proxy to hok-api server-side. They return just the profile --
 * tokens never come back in the response body.
 */
async function postSession<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/session/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Request failed: ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * All auth HTTP the Auth module makes. Reads (bootstrap-status, password
 * reset/update) still go straight to hok-api via apiFetch; anything that
 * mints or clears a session goes through the same-origin session routes so
 * the httpOnly refresh cookie is set server-side.
 */
export const authApi = {
  bootstrapStatus(): Promise<{ adminExists: boolean }> {
    return apiFetch("/auth/bootstrap-status");
  },

  bootstrap(payload: BootstrapPayload): Promise<{ ok: true }> {
    return apiFetch("/auth/bootstrap", { method: "POST", body: JSON.stringify(payload) });
  },

  login(payload: { email: string; password: string }): Promise<{ profile: Profile }> {
    return postSession("login", payload);
  },

  logout(): Promise<void> {
    // Best-effort revoke + cookie clear, server-side.
    return postSession<void>("logout").catch(() => undefined);
  },

  requestPasswordReset(payload: { email: string }): Promise<void> {
    return apiFetch("/auth/password-reset-request", { method: "POST", body: JSON.stringify(payload) });
  },

  /** Only used by the /auth/callback page, for a project configured for PKCE (a `?code=` link). */
  exchangeCode(payload: { code: string }): Promise<{ profile: Profile }> {
    return postSession("exchange-code", payload);
  },

  updatePassword(payload: { newPassword: string }): Promise<void> {
    return apiFetch("/auth/password-update", { method: "POST", body: JSON.stringify(payload) });
  },

  /** The signed-in user edits their own name, phone and time zone (PATCH /auth/me). An empty phone clears it. */
  updateOwnProfile(payload: { fullName: string; phone: string | null; timeZone: string }): Promise<{ profile: Profile }> {
    return apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify(payload) });
  },

  /** Stores a session obtained client-side (implicit email-link flow). See app/api/session/establish. */
  establish(payload: { accessToken: string; refreshToken: string }): Promise<void> {
    return postSession<void>("establish", payload);
  },
};
