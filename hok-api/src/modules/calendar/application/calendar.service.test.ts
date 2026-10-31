import { describe, expect, it } from "vitest";
import { CalendarService } from "./calendar.service";
import type { CalendarEventItem, CalendarPersonalItem } from "../domain/calendar.entity";
import type { CalendarEventFilters, CalendarPersonalFilters, CalendarRepositoryPort } from "./ports/calendar-repository.port";

function ev(id: string, startsAt: string): CalendarEventItem {
  return {
    kind: "event",
    id,
    title: id,
    startsAt,
    endsAt: startsAt,
    timeZone: "UTC",
    clientId: "c1",
    clientName: "Acme",
    ownerId: "rohan",
    eventType: "shoot",
    state: "active",
    currentStageName: "Planned",
    currentStagePosition: 1,
    stageCount: 3,
  };
}
function pe(id: string, startsAt: string): CalendarPersonalItem {
  return { kind: "personal", id, title: id, startsAt, endsAt: startsAt, timeZone: "UTC", clientId: null, clientName: null, ownerId: "rohan" };
}

class FakeRepo implements CalendarRepositoryPort {
  eventCalls: { f: CalendarEventFilters; limit: number }[] = [];
  personalCalls: { f: CalendarPersonalFilters; limit: number }[] = [];
  constructor(
    private events: CalendarEventItem[] = [],
    private personal: CalendarPersonalItem[] = [],
  ) {}
  eventsInRange(_r: unknown, f: CalendarEventFilters, limit: number) {
    this.eventCalls.push({ f, limit });
    return Promise.resolve(this.events.slice(0, limit));
  }
  personalInRange(_r: unknown, f: CalendarPersonalFilters, limit: number) {
    this.personalCalls.push({ f, limit });
    return Promise.resolve(this.personal.slice(0, limit));
  }
}

const RANGE = { from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z", include: "all" as const };

describe("CalendarService.feed", () => {
  it("merges both kinds by start, scoped to the manager, in two queries", async () => {
    const repo = new FakeRepo([ev("e1", "2026-10-05T10:00:00.000Z")], [pe("p1", "2026-10-03T10:00:00.000Z")]);
    const feed = await new CalendarService(repo).feed({ userId: "rohan", role: "social_media_manager" }, { ...RANGE, ownerId: "sara" });
    expect(feed.items.map((i) => i.id)).toEqual(["p1", "e1"]);
    expect(feed.truncated).toBe(false);
    expect(repo.eventCalls[0]?.f.ownerId).toBe("rohan");
    expect(repo.personalCalls[0]?.f.ownerId).toBe("rohan");
  });

  it("event-only filters and include=events leave personal entries out", async () => {
    const repo = new FakeRepo([], [pe("p1", "2026-10-03T10:00:00.000Z")]);
    const service = new CalendarService(repo);
    expect((await service.feed({ userId: "rohan", role: "social_media_manager" }, { ...RANGE, eventType: "shoot" })).items).toEqual([]);
    expect((await service.feed({ userId: "rohan", role: "social_media_manager" }, { ...RANGE, include: "events" })).items).toEqual([]);
    expect(repo.personalCalls).toHaveLength(0);
  });

  it("flags truncation when a kind exceeds the cap", async () => {
    const repo = new FakeRepo([ev("e1", "2026-10-01T10:00:00.000Z"), ev("e2", "2026-10-02T10:00:00.000Z"), ev("e3", "2026-10-03T10:00:00.000Z")]);
    const feed = await new CalendarService(repo, 2).feed({ userId: "admin", role: "admin" }, RANGE);
    expect(feed.items.filter((i) => i.kind === "event")).toHaveLength(2);
    expect(feed.truncated).toBe(true);
    expect(repo.eventCalls[0]?.limit).toBe(3);
  });

  it("refuses a range over 92 days", async () => {
    await expect(new CalendarService(new FakeRepo()).feed({ userId: "admin", role: "admin" }, { ...RANGE, to: "2027-03-01T00:00:00Z" })).rejects.toMatchObject({
      code: "CALENDAR_RANGE_INVALID",
    });
  });
});
