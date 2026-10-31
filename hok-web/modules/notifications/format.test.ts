import { describe, expect, it } from "vitest";
import {
  badgeLabel,
  safeAppPath,
  timeAgo,
  urlBase64ToUint8Array,
} from "./format";

describe("notification helpers", () => {
  const now = new Date("2026-10-16T12:00:00Z").getTime();
  it("timeAgo", () => {
    expect(timeAgo("2026-10-16T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-10-16T11:55:00Z", now)).toBe("5m ago");
    expect(timeAgo("2026-10-16T09:00:00Z", now)).toBe("3h ago");
    expect(timeAgo("2026-10-14T12:00:00Z", now)).toBe("2d ago");
  });
  it("badgeLabel", () => {
    expect(badgeLabel(0)).toBe("");
    expect(badgeLabel(7)).toBe("7");
    expect(badgeLabel(150)).toBe("99+");
  });
  it("safeAppPath", () => {
    expect(safeAppPath("/app/clients/1")).toBe("/app/clients/1");
    expect(safeAppPath("//evil.com")).toBeNull();
    expect(safeAppPath("https://evil.com")).toBeNull();
    expect(safeAppPath(null)).toBeNull();
  });
  it("urlBase64ToUint8Array", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID"))).toEqual([1, 2, 3]);
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([251, 255]);
  });
});
