import { describe, expect, it } from "vitest";
import { rangeProblem, scanLowerBound, spanProblem } from "./time-range";

describe("spanProblem", () => {
  it("accepts zero-length up to 31 days, across offsets", () => {
    expect(spanProblem("2026-10-14T10:00:00Z", "2026-10-14T10:00:00Z")).toBeNull();
    expect(spanProblem("2026-10-14T10:00:00+05:30", "2026-10-14T05:00:00Z")).toBeNull();
    expect(spanProblem("2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z")).toBeNull();
  });

  it("refuses an end before the start, more than 31 days, and garbage", () => {
    expect(spanProblem("2026-10-14T10:00:00Z", "2026-10-14T10:00:00+05:30")).not.toBeNull();
    expect(spanProblem("2026-10-01T00:00:00Z", "2026-11-01T00:00:01Z")).not.toBeNull();
    expect(spanProblem("nope", "2026-11-01T00:00:00Z")).not.toBeNull();
  });
});

describe("rangeProblem", () => {
  it("needs to after from and at most 92 days", () => {
    expect(rangeProblem("2026-10-01T00:00:00Z", "2026-12-31T00:00:00Z")).toBeNull();
    expect(rangeProblem("2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z")).not.toBeNull();
    expect(rangeProblem("2026-10-01T00:00:00Z", "2027-01-02T00:00:00Z")).not.toBeNull();
  });
});

describe("scanLowerBound", () => {
  it("is 31 days before from", () => {
    expect(scanLowerBound("2026-11-01T00:00:00Z").toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});
