import { describe, expect, it } from "vitest";
import { clientFormSchema, parseServices } from "./client";

const base = { businessName: "Acme", email: "", timeZone: "Asia/Kolkata", contractStart: "", contractEnd: "" };

describe("clientFormSchema", () => {
  it("accepts a minimal client", () => {
    expect(clientFormSchema.safeParse(base).success).toBe(true);
  });
  it("needs a business name and a named time zone", () => {
    expect(clientFormSchema.safeParse({ ...base, businessName: " " }).success).toBe(false);
    expect(clientFormSchema.safeParse({ ...base, timeZone: "+05:30" }).success).toBe(false);
  });
  it("rejects an end date before the start date", () => {
    expect(clientFormSchema.safeParse({ ...base, contractStart: "2026-05-01", contractEnd: "2026-04-01" }).success).toBe(false);
    expect(clientFormSchema.safeParse({ ...base, contractStart: "2026-04-01", contractEnd: "2026-05-01" }).success).toBe(true);
  });
});

describe("parseServices", () => {
  it("splits, trims and drops blanks", () => {
    expect(parseServices(" Reels, ,Shoots ,")).toEqual(["Reels", "Shoots"]);
  });
});
