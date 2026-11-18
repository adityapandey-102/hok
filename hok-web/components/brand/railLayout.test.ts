import { describe, expect, it } from "vitest";
import { gridColumns, highlightTotals, phoneLayout, railAriaLabel, railCaption, segmentsReached } from "./railLayout";

describe("stage rail layouts", () => {
  it("keeps the row up to 6 stages and wraps into a grid after", () => {
    // Always the grid on wider screens; never more columns than stages.
    expect([1, 3, 6, 13].map((n) => gridColumns(n, "sm"))).toEqual([1, 3, 4, 4]);
    expect([1, 3, 6, 13].map((n) => gridColumns(n, "lg"))).toEqual([1, 3, 6, 7]);
  });
  it("keeps the phone list up to 4 stages and drops down after", () => {
    expect([1, 4].map(phoneLayout)).toEqual(["list", "list"]);
    expect([5, 13].map(phoneLayout)).toEqual(["dropdown", "dropdown"]);
  });
});

describe("railCaption", () => {
  it("counts from one", () => {
    expect(railCaption("Stage", 4, 13)).toBe("Stage 5 of 13");
    expect(railCaption("Step", 0, 6)).toBe("Step 1 of 6");
  });
  it("says when everything is done or nothing has started", () => {
    expect(railCaption("Stage", 13, 13)).toBe("All 13 stages done");
    expect(railCaption("Step", 6, 6)).toBe("All 6 steps done");
    expect(railCaption("Step", -1, 6)).toBe("6 steps");
  });
});

describe("railAriaLabel", () => {
  const stages = [{ name: "Brief" }, { name: "Edit" }, { name: "Final" }];
  it("names the current stage and its place", () => {
    expect(railAriaLabel("Event stages", stages, 1, "Stage")).toBe("Event stages: Edit (Stage 2 of 3)");
    expect(railAriaLabel("Progress", stages, 2, "Step")).toBe("Progress: Final (Step 3 of 3)");
  });
  it("handles finished and not started", () => {
    expect(railAriaLabel("Task stages", stages, 3, "Stage")).toBe("Task stages: all 3 stages done");
    expect(railAriaLabel("Task stages", stages, -1, "Stage")).toBe("Task stages: 3 stages");
  });
});

describe("highlightTotals", () => {
  it("is quiet when nothing is highlighted", () => {
    expect(highlightTotals([{}, {}])).toEqual({ approval: false, files: 0 });
  });
  it("sums files and notices an approval", () => {
    expect(highlightTotals([{ files: 2, highlight: "files" }, { highlight: "approval", files: 1 }, {}])).toEqual({ approval: true, files: 3 });
  });
});

describe("segmentsReached", () => {
  it("inks the line up to and including the current cell", () => {
    expect(segmentsReached(0, 2)).toEqual({ incoming: true, outgoing: true });
    expect(segmentsReached(2, 2)).toEqual({ incoming: true, outgoing: false });
    expect(segmentsReached(3, 2)).toEqual({ incoming: false, outgoing: false });
  });
});
