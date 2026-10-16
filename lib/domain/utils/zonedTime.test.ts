import { describe, expect, it } from "vitest";
import { describeEventTime, isoToZonedInput, zonedWallTimeToIso, zoneOffsetMinutes } from "./zonedTime";

describe("zonedWallTimeToIso", () => {
  it("applies a fixed-offset zone", () => {
    expect(zonedWallTimeToIso("2026-10-20T10:00", "Asia/Kolkata")).toBe("2026-10-20T10:00:00+05:30");
  });

  it("uses BST in summer and GMT in winter for London", () => {
    expect(zonedWallTimeToIso("2026-07-01T09:00", "Europe/London")).toBe("2026-07-01T09:00:00+01:00");
    expect(zonedWallTimeToIso("2026-12-01T09:00", "Europe/London")).toBe("2026-12-01T09:00:00+00:00");
  });

  it("is correct either side of a DST change", () => {
    // New York springs forward on 2026-03-08 at 02:00.
    expect(zonedWallTimeToIso("2026-03-08T01:30", "America/New_York")).toBe("2026-03-08T01:30:00-05:00");
    expect(zonedWallTimeToIso("2026-03-08T03:30", "America/New_York")).toBe("2026-03-08T03:30:00-04:00");
    // The skipped 02:30 lands on the real following hour.
    expect(zonedWallTimeToIso("2026-03-08T02:30", "America/New_York")).toBe("2026-03-08T03:30:00-04:00");
  });

  it("round-trips the exact wall time", () => {
    const iso = zonedWallTimeToIso("2026-10-25T01:30", "Europe/London");
    expect(iso).not.toBeNull();
    expect(isoToZonedInput(iso!, "Europe/London")).toBe("2026-10-25T01:30");
  });

  it("rejects malformed input", () => {
    expect(zonedWallTimeToIso("tomorrow", "Asia/Kolkata")).toBeNull();
  });
});

describe("isoToZonedInput / offsets", () => {
  it("shows an instant on each zone wall clock", () => {
    const iso = "2026-10-20T04:30:00Z";
    expect(isoToZonedInput(iso, "Asia/Kolkata")).toBe("2026-10-20T10:00");
    expect(isoToZonedInput(iso, "Asia/Dubai")).toBe("2026-10-20T08:30");
    expect(zoneOffsetMinutes(new Date(iso).getTime(), "Asia/Kolkata")).toBe(330);
  });
});

describe("describeEventTime", () => {
  it("adds the event local time only when it differs from the viewer", () => {
    const iso = "2026-10-20T04:30:00Z";
    expect(describeEventTime(iso, "Asia/Kolkata", "Asia/Kolkata").secondary).toBeNull();
    const diff = describeEventTime(iso, "Asia/Kolkata", "Asia/Dubai");
    expect(diff.secondary).toContain("(event time)");
    expect(diff.primary).not.toBe(diff.secondary);
  });
});
