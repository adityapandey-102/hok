/**
 * The client portal's only HTTP calls (M8). Called from the CLIENT's browser,
 * straight to hok-api's public /portal/:token endpoints: no session, no
 * cookies, no Supabase. Calling from the browser (not the Next server) means
 * the API's per-IP rate limits key on the real visitor, and the token never
 * passes through this app's server logs. Shapes mirror hok-api's openapi.yaml
 * (PortalDashboard, PortalEvent, PortalComment).
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL!;

export interface PortalStage {
  position: number;
  name: string;
}

export interface PortalEvent {
  id: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  location: string | null;
  state: "active" | "cancelled" | "postponed";
  stages: PortalStage[];
  currentStagePosition: number;
  stageCount: number;
}

export interface PortalEventDetail extends PortalEvent {
  updates: { stageName: string; note: string | null; createdAt: string }[];
}

export interface PortalDashboard {
  client: { businessName: string; logoUrl: string | null; timeZone: string };
  manager: { firstName: string };
  current: PortalEvent | null;
  upcoming: PortalEvent[];
  recent: PortalEvent[];
}

export type PortalCommentStatus = "received" | "in_progress" | "solved";

export interface PortalComment {
  id: string;
  eventId: string | null;
  eventTitle: string | null;
  body: string;
  status: PortalCommentStatus;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

/** An API failure, with the stable code to branch on (never the message). */
export class PortalApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
  }
}

async function call<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/portal/${encodeURIComponent(token)}${path}`, {
      ...init,
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new PortalApiError("We couldn't reach the server. Check your connection and try again.", 0, null);
  }
  const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
  if (!res.ok) throw new PortalApiError(body?.error ?? "Something went wrong.", res.status, body?.code ?? null);
  return body as T;
}

export const publicPortalApi = {
  dashboard: (token: string) => call<PortalDashboard>(token, ""),
  events: (token: string, from: string, to: string) =>
    call<{ events: PortalEvent[]; timeZone: string }>(token, `/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  event: (token: string, eventId: string) => call<{ event: PortalEventDetail }>(token, `/events/${encodeURIComponent(eventId)}`),
  comments: (token: string, limit = 20, offset = 0) =>
    call<{ comments: PortalComment[]; total: number }>(token, `/comments?limit=${limit}&offset=${offset}`),
  postComment: (token: string, body: string, eventId: string | null) =>
    call<{ comment: PortalComment }>(token, "/comments", { method: "POST", body: JSON.stringify(eventId ? { body, eventId } : { body }) }),
};

/** The portal link's own error code: unknown, replaced, switched off, or the client was archived. */
export const LINK_INVALID = "PORTAL_LINK_INVALID";
