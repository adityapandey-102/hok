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

/** The caller's calendar subscribe link (FR-CAL-08). The token comes back only from `createFeedLink`. */
export type FeedLink = { createdAt: string } | null;

export const calendarFeedApi = {
  get(): Promise<{ link: FeedLink }> {
    return apiFetch("/calendar/feed-link");
  },
  create(): Promise<{ link: FeedLink; token: string }> {
    return apiFetch("/calendar/feed-link", { method: "POST" });
  },
  revoke(): Promise<null> {
    return apiFetch("/calendar/feed-link", { method: "DELETE" });
  },
};

/** The public .ics address calendar apps fetch (served by hok-api). */
export function feedUrl(token: string, apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""): string {
  return `${apiBase.replace(/\/+$/, "")}/calendar-feed/${token}.ics`;
}

/** Google Calendar's "add by URL" screen, pre-filled (it wants the webcal:// form). */
export function googleSubscribeUrl(url: string): string {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(url.replace(/^https?:\/\//, "webcal://"))}`;
}

/** Calendar apps fetch from their own servers, so a localhost address can't work for them. */
export function isLocalAddress(url: string): boolean {
  return /^https?:\/\/(localhost|127\.|\[::1\])/.test(url);
}
