import { describe, expect, it } from "vitest";
import { assetQueryDtoSchema, createAssetDtoSchema, tagQueryDtoSchema, updateAssetDtoSchema } from "./asset.dto";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const base = { clientId: CLIENT, title: "  Raw footage ", url: "https://drive.google.com/x", type: "video" };

describe("createAssetDtoSchema", () => {
  it("accepts a link, trims the title and normalises tags", () => {
    const r = createAssetDtoSchema.safeParse({ ...base, comment: "", tags: [" Reels", "reels", "#Shoot"] });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.title).toBe("Raw footage");
    expect(r.data.comment).toBeNull();
    expect(r.data.tags).toEqual(["Reels", "Shoot"]);
  });
  it("rejects non-http(s) links and an unknown type", () => {
    for (const url of ["javascript:alert(1)", "data:text/html,x", "ftp://a.b/c", "/relative", "drive.google.com"]) {
      expect(createAssetDtoSchema.safeParse({ ...base, url }).success, url).toBe(false);
    }
    expect(createAssetDtoSchema.safeParse({ ...base, type: "gif" }).success).toBe(false);
  });
  it("caps tags at 10 and 30 characters each", () => {
    expect(createAssetDtoSchema.safeParse({ ...base, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).success).toBe(false);
    expect(createAssetDtoSchema.safeParse({ ...base, tags: ["x".repeat(31)] }).success).toBe(false);
  });
  it("requires a title and a client id", () => {
    expect(createAssetDtoSchema.safeParse({ ...base, title: "  " }).success).toBe(false);
    expect(createAssetDtoSchema.safeParse({ ...base, clientId: "nope" }).success).toBe(false);
  });
});

describe("updateAssetDtoSchema", () => {
  it("requires a version and lets eventId be null", () => {
    expect(updateAssetDtoSchema.safeParse({ title: "x" }).success).toBe(false);
    expect(updateAssetDtoSchema.safeParse({ eventId: null, version: 1 }).success).toBe(true);
  });
});

describe("assetQueryDtoSchema", () => {
  it("clamps the limit and defaults the offset", () => {
    const r = assetQueryDtoSchema.parse({ limit: "100000" });
    expect(r.limit).toBe(100);
    expect(r.offset).toBe(0);
  });
  it("is strict about enums, ids and dates", () => {
    expect(assetQueryDtoSchema.safeParse({ type: "gif" }).success).toBe(false);
    expect(assetQueryDtoSchema.safeParse({ clientId: "x" }).success).toBe(false);
    expect(assetQueryDtoSchema.safeParse({ from: "2026-10-14" }).success).toBe(false);
    expect(assetQueryDtoSchema.safeParse({ from: "2026-10-14T00:00:00+05:30" }).success).toBe(true);
    expect(assetQueryDtoSchema.safeParse({ limit: "abc" }).success).toBe(false);
  });
});

describe("tagQueryDtoSchema", () => {
  it("caps the suggestion count at 50", () => {
    expect(tagQueryDtoSchema.parse({ limit: "999" }).limit).toBe(50);
  });
});
