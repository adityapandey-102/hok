import { describe, expect, it } from "vitest";
import { searchTimeZones, timeZoneLabel } from "./timeZoneOptions";

const JAN = new Date("2026-01-15T12:00:00Z"); // no daylight saving in Europe / US

describe("time zone search", () => {
  const ids = (q: string) => searchTimeZones(q, 20, JAN).map((z) => z.id);

  it("shows common zones when nothing is typed", () => {
    expect(ids("")).toEqual(expect.arrayContaining(["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York"]));
  });

  it("finds a zone by city, with the city match first", () => {
    expect(ids("london")[0]).toBe("Europe/London");
    expect(ids("dubai")[0]).toBe("Asia/Dubai");
    expect(ids("new york")[0]).toBe("America/New_York");
  });

  it("finds a zone by its common name or the zone id", () => {
    expect(ids("india")).toContain("Asia/Kolkata");
    expect(ids("america/chicago")).toContain("America/Chicago");
  });

  it("finds zones by offset, written several ways", () => {
    for (const q of ["+05:30", "+5:30", "GMT+5:30", "utc +5:30"]) expect(ids(q), q).toContain("Asia/Kolkata");
    expect(ids("+4")).toContain("Asia/Dubai");
    expect(ids("+4")).not.toContain("Asia/Kolkata");
  });

  it("labels a zone by city, name and current offset", () => {
    expect(timeZoneLabel("Asia/Kolkata", JAN)).toMatch(/^Kolkata · .+ \(GMT\+5:30\)$/);
    expect(timeZoneLabel("Europe/London", JAN)).toMatch(/\(GMT\+0\)$/);
  });
});
