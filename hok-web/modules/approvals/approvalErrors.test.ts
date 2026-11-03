import { describe, expect, it } from "vitest";
import { describeApprovalError, isApprovalStale, safeHttpUrl } from "./approvalErrors";

class CodeError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

describe("describeApprovalError", () => {
  it("maps known codes to plain text", () => {
    expect(describeApprovalError(new CodeError("x", "STAGE_APPROVAL_SELF"), "f")).toBe("You can't approve your own request.");
  });
  it("keeps the server's message for other codes (e.g. STAGE_APPROVAL_REQUIRED names the stage)", () => {
    expect(describeApprovalError(new CodeError("Stage Review needs approval first", "STAGE_APPROVAL_REQUIRED"), "f")).toBe("Stage Review needs approval first");
  });
  it("falls back for non-errors", () => {
    expect(describeApprovalError("boom", "Failed")).toBe("Failed");
  });
});

describe("isApprovalStale", () => {
  it("is true only for codes where the request changed under the user", () => {
    expect(isApprovalStale(new CodeError("x", "STAGE_APPROVAL_MODIFIED"))).toBe(true);
    expect(isApprovalStale(new CodeError("x", "STAGE_APPROVAL_SELF"))).toBe(false);
    expect(isApprovalStale(new Error("x"))).toBe(false);
  });
});

describe("safeHttpUrl", () => {
  it("accepts http and https only", () => {
    expect(safeHttpUrl("https://drive.google.com/a")).toBe("https://drive.google.com/a");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});
