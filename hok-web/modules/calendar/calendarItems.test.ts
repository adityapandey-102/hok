import { describe, expect, it } from "vitest";
import { fromFeedItem, type FeedItem } from "./calendarItems";

const base = { id: "1", title: "T", startsAt: "2026-11-20T04:30:00Z", endsAt: "2026-11-20T05:30:00Z", timeZone: "UTC", clientId: null, clientName: null, ownerId: "o" };

describe("fromFeedItem", () => {
  it("maps a client event to an event page link", () => {
    const item = fromFeedItem({ ...base, kind: "event", eventType: "shoot", state: "active", currentStageName: "Planning" } as FeedItem);
    expect(item).toMatchObject({ kind: "event", href: "/app/events/1", type: "shoot", stageName: "Planning" });
  });
  it("maps a personal entry with no href, stage or state", () => {
    const item = fromFeedItem({ ...base, kind: "personal" } as FeedItem);
    expect(item).toMatchObject({ kind: "personal", href: "", type: "personal", state: "active", stageName: null });
  });
});
