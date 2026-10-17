import { describe, expect, it } from "vitest";
import { addDays, dayKeyInZone, zonedMidnight } from "./zoned-day";

describe("zoned days", () => {
  it("finds the local day of an instant", () => {
    // 20:00 UTC on 15 Oct is already 16 Oct in Kolkata (+05:30), still 15 Oct in New York.
    const t = new Date("2026-10-15T20:00:00Z");
    expect(dayKeyInZone(t, "Asia/Kolkata")).toBe("2026-10-16");
    expect(dayKeyInZone(t, "America/New_York")).toBe("2026-10-15");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("returns local midnight as a UTC instant", () => {
    expect(zonedMidnight("2026-10-16", "Asia/Kolkata").toISOString()).toBe("2026-10-15T18:30:00.000Z");
    expect(zonedMidnight("2026-10-16", "UTC").toISOString()).toBe("2026-10-16T00:00:00.000Z");
  });

  it("handles DST changes", () => {
    // New York: EDT (-4) before 1 Nov 2026, EST (-5) after.
    expect(zonedMidnight("2026-11-01", "America/New_York").toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(zonedMidnight("2026-11-02", "America/New_York").toISOString()).toBe("2026-11-02T05:00:00.000Z");
    // London: BST (+1) on 29 Mar 2026 midnight is still GMT (change at 01:00).
    expect(zonedMidnight("2026-03-30", "Europe/London").toISOString()).toBe("2026-03-29T23:00:00.000Z");
  });
});
