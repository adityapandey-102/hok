import { describe, expect, it } from "vitest";
import { assertCommentVisible, assertHasChange, assertStatusTransition, assertVersion, excerpt } from "./client-comment.rules";
import type { ClientCommentEntity } from "./client-comment.entity";

const comment = (ownerId: string): ClientCommentEntity => ({
  id: "c1", clientId: "cl1", clientName: "Cafe", ownerId, teamIds: [ownerId], eventId: null, eventTitle: null, body: "Hi",
  status: "received", reply: null, repliedAt: null, repliedByName: null, version: 1, createdAt: "", updatedAt: "",
});

describe("comment status transitions (FR-CMT-03)", () => {
  it("allows forward moves, a direct solve and a reopen", () => {
    expect(() => assertStatusTransition("received", "in_progress")).not.toThrow();
    expect(() => assertStatusTransition("in_progress", "solved")).not.toThrow();
    expect(() => assertStatusTransition("received", "solved")).not.toThrow();
    expect(() => assertStatusTransition("solved", "in_progress")).not.toThrow();
  });

  it("allows keeping the status (a reply-only update)", () => {
    expect(() => assertStatusTransition("in_progress", "in_progress")).not.toThrow();
  });

  it("never goes back to received", () => {
    for (const from of ["in_progress", "solved"] as const) {
      expect(() => assertStatusTransition(from, "received")).toThrow(/can't move/);
    }
  });
});

describe("visibility, version, change", () => {
  it("hides another manager's comment as a 404 and shows it to the Admin", () => {
    expect(() => assertCommentVisible({ kind: "own", userId: "u2" }, comment("u1"))).toThrow(/not found/);
    expect(() => assertCommentVisible({ kind: "own", userId: "u2" }, null)).toThrow(/not found/);
    expect(assertCommentVisible({ kind: "all" }, comment("u1")).id).toBe("c1");
  });

  it("refuses a stale version and an empty update", () => {
    expect(() => assertVersion(2, 1)).toThrow(/Someone else/);
    expect(() => assertVersion(2, 2)).not.toThrow();
    expect(() => assertHasChange(undefined, undefined)).toThrow();
    expect(() => assertHasChange(undefined, null)).not.toThrow();
  });

  it("makes short single-line excerpts", () => {
    expect(excerpt("a\n  b")).toBe("a b");
    expect(excerpt("x".repeat(100), 10)).toHaveLength(10);
  });
});
