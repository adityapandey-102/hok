import { describe, expect, it } from "vitest";
import type { PortalAsset, PortalStage } from "./api/publicPortalApi";
import { focusTargetId, groupFilesByStep, isNewFile, safeHttpUrl, shouldRipple, tabFromHash, visitKey } from "./portalLogic";

const stages: PortalStage[] = [1, 2, 3, 4].map((p) => ({ position: p, name: ["Brief", "Shoot", "Edit", "Final"][p - 1]! }));
const asset = (id: string, stagePosition: number | null, stageName: string | null = null): PortalAsset => ({ id, title: id, url: `https://x.test/${id}`, type: "video", stageName, stagePosition, createdAt: "2026-11-10T10:00:00Z" });

describe("tabFromHash", () => {
  it("maps the hash to a tab and falls back to the overview", () => {
    expect(tabFromHash("#calendar")).toBe("calendar");
    expect(tabFromHash("#messages")).toBe("messages");
    expect(tabFromHash("#overview")).toBe("overview");
    expect(tabFromHash("")).toBe("overview");
    expect(tabFromHash("#nope")).toBe("overview");
  });
});

describe("isNewFile", () => {
  it("marks files shared after the last visit only", () => {
    const last = Date.parse("2026-11-10T00:00:00Z");
    expect(isNewFile("2026-11-10T10:00:00Z", last)).toBe(true);
    expect(isNewFile("2026-11-09T10:00:00Z", last)).toBe(false);
  });
  it("marks nothing without a last visit or with a bad date", () => {
    expect(isNewFile("2026-11-10T10:00:00Z", null)).toBe(false);
    expect(isNewFile("not a date", 0)).toBe(false);
  });
});

describe("visitKey", () => {
  it("is stable, differs per token and never contains the token", () => {
    expect(visitKey("abc123")).toBe(visitKey("abc123"));
    expect(visitKey("abc123")).not.toBe(visitKey("abc124"));
    expect(visitKey("abc123")).not.toContain("abc123");
  });
});

describe("shouldRipple", () => {
  it("ripples on files newer than the last visit, and on all tags when the last visit is unknown", () => {
    const last = Date.parse("2026-11-10T00:00:00Z");
    expect(shouldRipple("2026-11-11T00:00:00Z", last)).toBe(true);
    expect(shouldRipple("2026-11-09T00:00:00Z", last)).toBe(false);
    expect(shouldRipple("2026-11-09T00:00:00Z", null)).toBe(true);
    expect(shouldRipple(null, null)).toBe(false);
  });
});

describe("groupFilesByStep", () => {
  const assets = [asset("a", 4), asset("b", 1), asset("c", 3), asset("d", null), asset("e", 3), asset("f", 2)];
  it("puts the awaiting step first, then the current step, then the rest in order, then other files", () => {
    const g = groupFilesByStep(assets, stages, 4, 3);
    expect(g.map((x) => x.key)).toEqual(["step-4", "step-3", "step-1", "step-2", "other"]);
    expect(g[0]!.title).toBe("Step 4 · Final");
    expect(g[1]!.files.map((f) => f.id)).toEqual(["c", "e"]);
    expect(g[4]!.title).toBe("Other files");
  });
  it("starts with the current step when nothing awaits approval", () => {
    expect(groupFilesByStep(assets, stages, null, 2).map((x) => x.key)).toEqual(["step-2", "step-1", "step-3", "step-4", "other"]);
  });
  it("falls back to the asset's own stage name, then to a bare step number", () => {
    expect(groupFilesByStep([asset("z", 9, "Archive")], stages, null, 1)[0]!.title).toBe("Step 9 · Archive");
    expect(groupFilesByStep([asset("z", 9)], stages, null, 1)[0]!.title).toBe("Step 9");
  });
  it("is empty without files", () => {
    expect(groupFilesByStep([], stages, null, 1)).toEqual([]);
  });
});

describe("focusTargetId", () => {
  const groups = groupFilesByStep([asset("a", 2)], stages, null, 1);
  it("finds the approval, the files or a step's group", () => {
    expect(focusTargetId("approval", true, groups)).toBe("pe-approval");
    expect(focusTargetId("approval", false, groups)).toBe("pe-files");
    expect(focusTargetId("files", false, groups)).toBe("pe-files");
    expect(focusTargetId("comment", false, [])).toBe("pe-comment");
    expect(focusTargetId({ step: 2 }, false, groups)).toBe("pe-step-2");
    expect(focusTargetId({ step: 3 }, false, groups)).toBe("pe-files");
  });
  it("has nowhere to go without a focus or files", () => {
    expect(focusTargetId(undefined, true, groups)).toBeNull();
    expect(focusTargetId("files", false, [])).toBeNull();
  });
});

describe("safeHttpUrl", () => {
  it("only lets http and https through", () => {
    expect(safeHttpUrl("https://drive.google.com/x")).toBe("https://drive.google.com/x");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
  });
});
