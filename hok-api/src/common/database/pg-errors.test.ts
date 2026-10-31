import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./pg-errors";

describe("isUniqueViolation", () => {
  const pg = Object.assign(new Error("duplicate key"), { code: "23505", constraint: "stage_templates_name_key" });

  it("recognises a raw pg error and one wrapped in `cause` (Drizzle)", () => {
    expect(isUniqueViolation(pg)).toBe(true);
    expect(isUniqueViolation(new Error("wrapped", { cause: pg }))).toBe(true);
  });

  it("can require a specific constraint", () => {
    expect(isUniqueViolation(pg, "stage_templates_name_key")).toBe(true);
    expect(isUniqueViolation(pg, "other_key")).toBe(false);
  });

  it("is false for other errors", () => {
    expect(isUniqueViolation(Object.assign(new Error("fk"), { code: "23503" }))).toBe(false);
    expect(isUniqueViolation(new Error("plain"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
