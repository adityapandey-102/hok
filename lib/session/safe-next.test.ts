import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext (open-redirect guard)", () => {
  it("keeps paths on this site, with their query and hash", () => {
    expect(safeNext("/app/clients?tab=todos#x")).toBe("/app/clients?tab=todos#x");
    expect(safeNext("/update-password")).toBe("/update-password");
  });

  it("refuses anything that leaves the site", () => {
    for (const bad of ["https://evil.example/login", "//evil.example", "/\\evil.example", "/\t/evil.example", "\\\\evil.example", "javascript:alert(1)", "evil.example"]) {
      expect(safeNext(bad), JSON.stringify(bad)).toBe("/app");
    }
  });

  it("falls back when missing", () => {
    expect(safeNext(null)).toBe("/app");
    expect(safeNext("", "/login")).toBe("/login");
  });
});
