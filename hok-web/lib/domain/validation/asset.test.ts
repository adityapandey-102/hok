import { describe, expect, it } from "vitest";
import { assetFormSchema, dayStartIso, isHttpUrl, nextDay, normalizeTags } from "./asset";

describe("isHttpUrl", () => {
  it("accepts http(s) links only", () => {
    expect(isHttpUrl("https://drive.google.com/x")).toBe(true);
    expect(isHttpUrl("http://a.test")).toBe(true);
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://a.b", "drive.google.com", "", "/x"]) {
      expect(isHttpUrl(bad), bad).toBe(false);
    }
  });
});

describe("normalizeTags", () => {
  it("trims, drops #, de-duplicates ignoring case", () => {
    expect(normalizeTags([" Reels", "#reels", "Festive  sale", ""])).toEqual(["Reels", "Festive sale"]);
  });
});

describe("assetFormSchema", () => {
  const ok = { title: "Raw", url: "https://a.test/x", type: "video", comment: "", tags: [] };
  it("accepts a valid form", () => {
    expect(assetFormSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects a bad link, empty title, too many or long tags", () => {
    expect(assetFormSchema.safeParse({ ...ok, url: "nope" }).success).toBe(false);
    expect(assetFormSchema.safeParse({ ...ok, title: " " }).success).toBe(false);
    expect(assetFormSchema.safeParse({ ...ok, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).success).toBe(false);
    expect(assetFormSchema.safeParse({ ...ok, tags: ["x".repeat(31)] }).success).toBe(false);
  });
});

describe("day helpers", () => {
  it("nextDay crosses month and year ends", () => {
    expect(nextDay("2026-10-31")).toBe("2026-11-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });
  it("dayStartIso is the viewer's midnight", () => {
    expect(dayStartIso("2026-10-14", "Asia/Kolkata")).toBe("2026-10-14T00:00:00+05:30");
  });
});
