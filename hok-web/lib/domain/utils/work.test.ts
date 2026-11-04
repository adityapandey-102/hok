import { describe, expect, it } from "vitest";
import type { WorkChild } from "../types/work";
import {
  bulkTitles,
  clampPartCount,
  createdSummary,
  creatingLabel,
  groupPartsByStage,
  hiddenPartsLabel,
  isPartSettled,
  partHref,
  partProgressLabel,
  partsSummary,
  workErrorMessage,
} from "./work";

const part = (over: Partial<WorkChild>): WorkChild => ({
  kind: "event",
  id: "c1",
  title: "Reel 1",
  stageId: "s2",
  stageName: "Production",
  currentStageName: "Rough cut",
  currentPosition: 2,
  stageCount: 5,
  status: null,
  state: "active",
  finished: false,
  assigneeName: null,
  ...over,
});

describe("clampPartCount", () => {
  it("keeps 1 to 20 and fixes the rest", () => {
    expect(clampPartCount("3")).toBe(3);
    expect(clampPartCount(20)).toBe(20);
    expect(clampPartCount("21")).toBe(20);
    expect(clampPartCount("0")).toBe(1);
    expect(clampPartCount("-4")).toBe(1);
    expect(clampPartCount("")).toBe(1);
    expect(clampPartCount("abc")).toBe(1);
    expect(clampPartCount("2.9")).toBe(2);
  });
});

describe("bulkTitles", () => {
  it("keeps one title as typed", () => {
    expect(bulkTitles("  Reel  ", 1)).toEqual(["Reel"]);
  });
  it("numbers many from 1", () => {
    expect(bulkTitles("Reel", 3)).toEqual(["Reel 1", "Reel 2", "Reel 3"]);
    expect(bulkTitles("Reel", 10)[9]).toBe("Reel 10");
  });
  it("caps at 20 and treats a bad count as 1", () => {
    expect(bulkTitles("R", 99)).toHaveLength(20);
    expect(bulkTitles("R", 0)).toEqual(["R"]);
  });
  it("cuts a long title so the number still fits in 160 characters", () => {
    const titles = bulkTitles("x".repeat(160), 12);
    expect(titles[11]).toHaveLength(160);
    expect(titles[11]!.endsWith(" 12")).toBe(true);
    expect(new Set(titles).size).toBe(12);
  });
});

describe("partProgressLabel", () => {
  it("shows the stage and position while it is open", () => {
    expect(partProgressLabel(part({}))).toBe("Rough cut · 2/5");
  });
  it("says Done when finished", () => {
    expect(partProgressLabel(part({ finished: true }))).toBe("Done");
    expect(partProgressLabel(part({ kind: "task", state: null, status: "done", finished: true }))).toBe("Done");
  });
  it("says Cancelled for a cancelled event (state, not finished)", () => {
    expect(partProgressLabel(part({ state: "cancelled" }))).toBe("Cancelled");
  });
  it("says Postponed for a postponed event", () => {
    expect(partProgressLabel(part({ state: "postponed" }))).toBe("Postponed");
  });
});

describe("isPartSettled", () => {
  it("is true for finished parts and cancelled events only", () => {
    expect(isPartSettled(part({}))).toBe(false);
    expect(isPartSettled(part({ finished: true }))).toBe(true);
    expect(isPartSettled(part({ state: "cancelled" }))).toBe(true);
    expect(isPartSettled(part({ state: "postponed" }))).toBe(false);
  });
});

describe("groupPartsByStage", () => {
  const stages = [
    { id: "s3", name: "Review", position: 3 },
    { id: "s1", name: "Brief", position: 1 },
    { id: "s2", name: "Production", position: 2, openChildren: 4 },
  ];
  it("groups in stage order and leaves out stages without parts", () => {
    const groups = groupPartsByStage([part({ id: "a", stageId: "s3", stageName: "Review" }), part({ id: "b" }), part({ id: "c" })], stages);
    expect(groups.map((g) => g.stageName)).toEqual(["Production", "Review"]);
    expect(groups[0]!.parts.map((p) => p.id)).toEqual(["b", "c"]);
  });
  it("prefers the API's open count (it includes parts you can't see) and counts visible ones otherwise", () => {
    const groups = groupPartsByStage([part({ id: "a", stageId: "s3", finished: true }), part({ id: "b", stageId: "s3" }), part({ id: "c" })], stages);
    expect(groups.find((g) => g.stageId === "s2")!.open).toBe(4);
    expect(groups.find((g) => g.stageId === "s3")!.open).toBe(1);
  });
});

describe("partsSummary and hidden label", () => {
  it("counts finished of all, leaving cancelled events out", () => {
    expect(partsSummary([part({ finished: true }), part({}), part({ state: "cancelled" })])).toBe("1 of 2 parts finished");
    expect(partsSummary([part({ finished: true })])).toBe("1 of 1 part finished");
  });
  it("says how many parts you can't see", () => {
    expect(hiddenPartsLabel(0)).toBeNull();
    expect(hiddenPartsLabel(2)).toBe("+2 you can't see");
  });
});

describe("workErrorMessage", () => {
  it("covers the five new codes and nothing else", () => {
    for (const code of ["STAGE_CHILDREN_OPEN", "WORK_TOO_DEEP", "WORK_PARENT_STAGE_INVALID", "WORK_CHILD_EVENT_NEEDS_CLIENT", "WORK_CHILD_CLIENT_MISMATCH"]) {
      expect(workErrorMessage(code)).toBeTruthy();
    }
    expect(workErrorMessage("WORK_TOO_DEEP")).toContain("3 levels");
    expect(workErrorMessage("SOMETHING_ELSE")).toBeNull();
    expect(workErrorMessage(undefined)).toBeNull();
  });
});

describe("links and progress text", () => {
  it("links to the right page", () => {
    expect(partHref({ kind: "event", id: "e1" })).toBe("/app/events/e1");
    expect(partHref({ kind: "task", id: "t1" })).toBe("/app/tasks/t1");
  });
  it("counts up while creating", () => {
    expect(creatingLabel(0, 10)).toBe("Creating 1 of 10…");
    expect(creatingLabel(2, 10)).toBe("Creating 3 of 10…");
    expect(creatingLabel(10, 10)).toBe("Creating 10 of 10…");
  });
  it("summarises all made, or where it stopped", () => {
    expect(createdSummary(1, 1)).toBe("Part created.");
    expect(createdSummary(10, 10)).toBe("10 parts created.");
    expect(createdSummary(3, 10, "Parts can only go 3 levels deep.")).toBe("3 of 10 parts created. Stopped at part 4: Parts can only go 3 levels deep.");
  });
});
