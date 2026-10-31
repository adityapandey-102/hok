import { apiFetch } from "../../lib/api/client";
import type { EventType } from "../../lib/domain";
import type { FeedResult } from "./calendarItems";

export interface CalendarFeedFilters {
  from: string;
  to: string;
  include?: "all" | "events" | "personal";
  clientId?: string;
  ownerId?: string;
  eventType?: EventType;
}

export const calendarApi = {
  feed(filters: CalendarFeedFilters): Promise<FeedResult> {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") q.set(key, String(value));
    }
    return apiFetch(`/calendar?${q.toString()}`);
  },
};

/** The caller's calendar subscribe link (FR-CAL-08). The token and address come back only from `create`. */
export type FeedLink = { createdAt: string } | null;

export const calendarFeedApi = {
  get(): Promise<{ link: FeedLink }> {
    return apiFetch("/calendar/feed-link");
  },
  /** `url` is built by hok-api from its own public address, so every calendar app gets one that works. */
  create(): Promise<{ link: NonNullable<FeedLink>; token: string; url: string }> {
    return apiFetch("/calendar/feed-link", { method: "POST" });
  },
  revoke(): Promise<null> {
    return apiFetch("/calendar/feed-link", { method: "DELETE" });
  },
};

/**
 * Google Calendar's "add by URL" screen, pre-filled. The https address is
 * passed as-is: rewriting it to webcal:// drops the scheme, and apps that
 * read webcal as plain http would send the secret token unencrypted.
 */
export function googleSubscribeUrl(url: string): string {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(url)}`;
}

const PRIVATE_V4: [number, number, number][] = [
  // [first octet, second octet from, second octet to]
  [0, 0, 255],
  [10, 0, 255],
  [100, 64, 127], // CGNAT
  [127, 0, 255],
  [169, 254, 254],
  [172, 16, 31],
  [192, 168, 168],
];

/**
 * True when Google (or any calendar app's servers) can't reach this address
 * from the internet: localhost, private or link-local networks (incl. the
 * LAN IP used for phone testing), `.local` / `.localhost` names, and bare
 * machine names. Calendar apps fetch from their own servers, so such a link
 * can't work for them yet.
 */
export function isLocalAddress(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
  } catch {
    return true;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return PRIVATE_V4.some(([first, from, to]) => a === first && b >= from && b <= to);
  }
  if (host.includes(":")) return host === "::" || host === "::1" || /^f[cd]/.test(host) || /^fe[89ab]/.test(host);
  return !host.includes("."); // a bare machine name only resolves on its own network
}
