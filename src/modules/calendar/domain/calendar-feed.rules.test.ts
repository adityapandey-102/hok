import { describe, expect, it } from "vitest";
import { feedTokenFrom, feedWindow, toIcs } from "./calendar-feed.rules";
import type { CalendarItem } from "./calendar.entity";

const event: CalendarItem = {
  kind: "event",
  id: "e1",
  title: "Diwali shoot; day 1, studio",
  startsAt: "2026-10-21T09:30:00.000Z",
  endsAt: "2026-10-21T12:00:00.000Z",
  timeZone: "Asia/Kolkata",
  clientId: "c1",
  clientName: "Chai Point Cafe",
  ownerId: "o1",
  eventType: "shoot",
  state: "cancelled",
  currentStageName: "Planning",
  currentStagePosition: 1,
  stageCount: 4,
};
const personal: CalendarItem = {
  kind: "personal",
  id: "p1",
  title: "Call\nback",
  startsAt: "2026-10-22T05:00:00.000Z",
  endsAt: "2026-10-22T05:30:00.000Z",
  timeZone: "Asia/Kolkata",
  clientId: null,
  clientName: null,
  ownerId: "o1",
};
const opts = { calendarName: "HOK · Rohan", webAppUrl: "https://hok.example/", now: new Date("2026-10-20T00:00:00Z") };

describe("toIcs", () => {
  const ics = toIcs([event, personal], opts);
  const lines = ics.split("\r\n");

  it("is a CRLF calendar with one VEVENT per item, times in UTC", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    expect(lines).toContain("DTSTART:20261021T093000Z");
    expect(lines).toContain("DTEND:20261021T120000Z");
    expect(lines).toContain("UID:event-e1@hok");
    expect(lines).toContain("DTSTAMP:20261020T000000Z");
  });

  it("escapes text and marks cancelled events; links client events back to HOK", () => {
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("SUMMARY:Diwali shoot\\; day 1\\, studio · Chai Point Cafe");
    expect(unfolded).toContain("Stage: Planning (1 of 4)");
    expect(lines).toContain("STATUS:CANCELLED");
    expect(lines).toContain("URL:https://hok.example/app/events/e1");
    expect(lines).toContain("SUMMARY:Call\\nback");
  });

  it("folds lines longer than 75 bytes without splitting a character", () => {
    const long = toIcs([{ ...personal, title: "é".repeat(100) }], opts);
    for (const line of long.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(long.replace(/\r\n /g, "")).toContain(`SUMMARY:${"é".repeat(100)}`);
  });
});

describe("feed helpers", () => {
  it("reads the token only from <43-char token>.ics", () => {
    const token = "a".repeat(43);
    expect(feedTokenFrom(`${token}.ics`)).toBe(token);
    expect(feedTokenFrom(token)).toBeNull();
    expect(feedTokenFrom(`${token}x.ics`)).toBeNull();
    expect(feedTokenFrom("../x.ics")).toBeNull();
  });

  it("covers the last 30 days and the next 180", () => {
    expect(feedWindow(new Date("2026-10-21T00:00:00Z"))).toEqual({ from: "2026-09-21T00:00:00.000Z", to: "2027-04-19T00:00:00.000Z" });
  });
});
