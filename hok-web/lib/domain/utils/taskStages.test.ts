import { describe, expect, it } from "vitest";
import { isLastStage, linkDisplayName, nextStageOf, otherStages, stageProgressLabel, templateRolesLabel } from "./taskStages";

const stages = [
  { id: "c", name: "Review", position: 3 },
  { id: "a", name: "Cut", position: 1 },
  { id: "b", name: "Rough cut", position: 2 },
];

describe("stageProgressLabel", () => {
  it("writes the stage and how far along", () => {
    expect(stageProgressLabel({ name: "Rough cut", position: 2 }, 5)).toBe("Rough cut · 2/5");
  });
});

describe("stage navigation", () => {
  it("finds the next stage in position order, not array order", () => {
    expect(nextStageOf(stages, "a")?.id).toBe("b");
    expect(nextStageOf(stages, "b")?.id).toBe("c");
  });
  it("has no next stage on the last one or for an unknown id", () => {
    expect(nextStageOf(stages, "c")).toBeNull();
    expect(nextStageOf(stages, "zzz")).toBeNull();
    expect(nextStageOf([], "a")).toBeNull();
  });
  it("is on the last stage only when the id is the final stage", () => {
    expect(isLastStage(stages, "c")).toBe(true);
    expect(isLastStage(stages, "a")).toBe(false);
    expect(isLastStage(stages, "zzz")).toBe(false);
    expect(isLastStage([], "a")).toBe(false);
  });
  it("lists the other stages in order for the jump menu", () => {
    expect(otherStages(stages, "b").map((s) => s.name)).toEqual(["Cut", "Review"]);
  });
});

describe("linkDisplayName", () => {
  it("prefers the label", () => {
    expect(linkDisplayName({ label: " Raw files ", url: "https://drive.google.com/x" })).toBe("Raw files");
  });
  it("falls back to the host, then the raw text", () => {
    expect(linkDisplayName({ label: null, url: "https://drive.google.com/drive/folders/1" })).toBe("drive.google.com");
    expect(linkDisplayName({ label: "  ", url: "https://dropbox.com/s/1" })).toBe("dropbox.com");
    expect(linkDisplayName({ label: null, url: "not a url" })).toBe("not a url");
  });
});

describe("templateRolesLabel", () => {
  it("says Any role when empty, else names the roles", () => {
    expect(templateRolesLabel([])).toBe("Any role");
    expect(templateRolesLabel(["editor", "content_writer"])).toBe("Editor, Content Writer");
  });
});
