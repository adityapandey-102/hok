import { describe, expect, it } from "vitest";
import { clampActive, moveActive } from "./searchSelectHelpers";

describe("moveActive", () => {
  it("wraps in both directions", () => {
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
    expect(moveActive(0, 1, 3)).toBe(1);
  });
  it("starts at the ends from nothing and handles empty lists", () => {
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(-1, -1, 3)).toBe(2);
    expect(moveActive(0, 1, 0)).toBe(-1);
  });
});

describe("clampActive", () => {
  it("keeps the index in range", () => {
    expect(clampActive(5, 3)).toBe(2);
    expect(clampActive(-1, 3)).toBe(0);
    expect(clampActive(1, 0)).toBe(-1);
  });
});
