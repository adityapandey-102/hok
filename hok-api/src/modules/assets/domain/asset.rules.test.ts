import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import { assertAssetVersion, assertAssetVisible, assertClientUsable, assertEventLinkable, assertRange, normalizeTags, tagsWithinLimits } from "./asset.rules";

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? `${e.statusCode}:${e.code}` : "other";
  }
  return "none";
};

describe("normalizeTags", () => {
  it("trims, collapses spaces, drops # and empties", () => {
    expect(normalizeTags(["  Reels ", "#festive   sale", "", "   "])).toEqual(["Reels", "festive sale"]);
  });
  it("de-duplicates ignoring case, keeping the first spelling", () => {
    expect(normalizeTags(["Reels", "reels", "REELS", "Shoot"])).toEqual(["Reels", "Shoot"]);
  });
  it("checks the caps", () => {
    expect(tagsWithinLimits(Array.from({ length: 10 }, (_, i) => `t${i}`))).toBe(true);
    expect(tagsWithinLimits(Array.from({ length: 11 }, (_, i) => `t${i}`))).toBe(false);
    expect(tagsWithinLimits(["x".repeat(31)])).toBe(false);
  });
});

describe("row scope", () => {
  it("an admin sees every asset; a manager only their own clients (else 404)", () => {
    expect(code(() => assertAssetVisible({ kind: "all" }, { teamIds: ["a"] }))).toBe("none");
    expect(code(() => assertAssetVisible({ kind: "own", userId: "a" }, { teamIds: ["a"] }))).toBe("none");
    expect(code(() => assertAssetVisible({ kind: "own", userId: "b" }, { teamIds: ["a"] }))).toBe("404:ASSET_NOT_FOUND");
    expect(code(() => assertAssetVisible({ kind: "all" }, null))).toBe("404:ASSET_NOT_FOUND");
  });
  it("a client must be visible and not archived", () => {
    const c = { id: "c", teamIds: ["a"], status: "active" as const };
    expect(code(() => assertClientUsable({ kind: "own", userId: "b" }, c))).toBe("404:CLIENT_NOT_FOUND");
    expect(code(() => assertClientUsable({ kind: "own", userId: "a" }, { ...c, status: "archived" }))).toBe("409:CLIENT_ARCHIVED");
    expect(code(() => assertClientUsable({ kind: "own", userId: "a" }, { ...c, status: "paused" }))).toBe("none");
  });
});

describe("version, event link and range", () => {
  it("a stale version is 409; no version is allowed", () => {
    expect(code(() => assertAssetVersion(2, 1))).toBe("409:ASSET_MODIFIED");
    expect(code(() => assertAssetVersion(2, 2))).toBe("none");
    expect(code(() => assertAssetVersion(2, undefined))).toBe("none");
  });
  it("an event must exist and belong to the same client", () => {
    expect(code(() => assertEventLinkable("c1", { id: "e", clientId: "c1" }))).toBe("none");
    expect(code(() => assertEventLinkable("c1", { id: "e", clientId: "c2" }))).toBe("400:ASSET_EVENT_INVALID");
    expect(code(() => assertEventLinkable("c1", null))).toBe("400:ASSET_EVENT_INVALID");
  });
  it("from after to is 400", () => {
    expect(code(() => assertRange(new Date(2), new Date(1)))).toBe("400:ASSET_RANGE_INVALID");
    expect(code(() => assertRange(new Date(1), new Date(2)))).toBe("none");
  });
});
