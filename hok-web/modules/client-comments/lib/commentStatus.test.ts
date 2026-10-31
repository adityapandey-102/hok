import { describe, expect, it } from "vitest";
import { allowedMoves, moveLabel } from "./commentStatus";

describe("comment status moves", () => {
  it("never offers received as a target", () => {
    for (const s of ["received", "in_progress", "solved"] as const) {
      expect(allowedMoves(s)).not.toContain("received");
      expect(allowedMoves(s)).not.toContain(s);
    }
  });
  it("allows the documented moves", () => {
    expect(allowedMoves("received")).toEqual(["in_progress", "solved"]);
    expect(allowedMoves("in_progress")).toEqual(["solved"]);
    expect(allowedMoves("solved")).toEqual(["in_progress"]);
  });
  it("labels reopen", () => {
    expect(moveLabel("solved", "in_progress")).toBe("Reopen");
    expect(moveLabel("received", "in_progress")).toBe("Mark in progress");
    expect(moveLabel("received", "solved")).toBe("Mark solved");
  });
});
