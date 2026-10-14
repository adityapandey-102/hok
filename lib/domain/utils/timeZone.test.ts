import { describe, expect, it } from "vitest";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "./timeZone";

describe("isValidTimeZone", () => {
  it("accepts IANA zone names", () => {
    for (const zone of [DEFAULT_TIME_ZONE, "Europe/London", "America/New_York", "UTC", "Asia/Dubai"]) {
      expect(isValidTimeZone(zone)).toBe(true);
    }
  });

  it("rejects typos, offsets and empty values", () => {
    for (const zone of ["", "Asia/Kolkatta", "+05:30", "India", "x".repeat(65)]) {
      expect(isValidTimeZone(zone)).toBe(false);
    }
  });
});
