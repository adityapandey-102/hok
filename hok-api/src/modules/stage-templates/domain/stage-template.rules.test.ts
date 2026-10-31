import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { assertTemplateVersion, normalizeStageNames } from "./stage-template.rules";

function codeOf(fn: () => unknown): string | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return err.code;
  }
}

describe("normalizeStageNames", () => {
  it("trims names and keeps the order", () => {
    expect(normalizeStageNames([" Planned ", "Shoot", "Editing"])).toEqual(["Planned", "Shoot", "Editing"]);
  });

  it("refuses a repeated stage, ignoring case (400 STAGE_TEMPLATE_STAGES_INVALID)", () => {
    expect(codeOf(() => normalizeStageNames(["Shoot", "Editing", "shoot"]))).toBe("STAGE_TEMPLATE_STAGES_INVALID");
  });

  it("refuses a blank stage", () => {
    expect(codeOf(() => normalizeStageNames(["Planned", "  "]))).toBe("STAGE_TEMPLATE_STAGES_INVALID");
  });
});

describe("assertTemplateVersion", () => {
  it("passes on a match or when no version is sent; 409 STAGE_TEMPLATE_MODIFIED when stale", () => {
    expect(codeOf(() => assertTemplateVersion(2, 2))).toBeNull();
    expect(codeOf(() => assertTemplateVersion(2, undefined))).toBeNull();
    expect(codeOf(() => assertTemplateVersion(2, 1))).toBe("STAGE_TEMPLATE_MODIFIED");
  });
});
