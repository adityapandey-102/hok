import { describe, expect, it } from "vitest";
import { joinPhone, phoneCountries, splitPhone } from "./phoneCodes";

describe("phone country codes", () => {
  it("lists common countries first, with names from the browser", () => {
    const list = phoneCountries();
    expect(list.slice(0, 3).map((c) => c.iso)).toEqual(["IN", "AE", "SA"]);
    expect(list.find((c) => c.iso === "AE")).toMatchObject({ code: "971", name: "United Arab Emirates" });
    expect(new Set(list.map((c) => c.iso)).size).toBe(list.length);
  });

  it("splits a stored number into country and local part", () => {
    expect(splitPhone("+971 50 123 4567")).toEqual({ iso: "AE", local: "50 123 4567" });
    expect(splitPhone("+91 98200 11111")).toEqual({ iso: "IN", local: "98200 11111" });
    expect(splitPhone("+44 20 7946 0958")).toEqual({ iso: "GB", local: "20 7946 0958" });
    expect(splitPhone("+1 415 555 0100")).toEqual({ iso: "US", local: "415 555 0100" });
    expect(splitPhone("+1 416 555 0100", "CA")).toEqual({ iso: "CA", local: "416 555 0100" });
  });

  it("keeps a number without + as typed, under the default country", () => {
    expect(splitPhone("98200 11111")).toEqual({ iso: "IN", local: "98200 11111" });
    expect(splitPhone("")).toEqual({ iso: "IN", local: "" });
  });

  it("joins back to one international number", () => {
    expect(joinPhone("AE", "50 123 4567")).toBe("+971 50 123 4567");
    expect(joinPhone("AE", "050 123 4567")).toBe("+971 50 123 4567"); // trunk 0 dropped
    expect(joinPhone("IN", "  ")).toBe("");
    expect(joinPhone("IN", "+44 20 7946 0958")).toBe("+44 20 7946 0958"); // typed with its own code
  });

  it("round-trips", () => {
    for (const n of ["+971 50 123 4567", "+91 98200 11111", "+65 6123 4567"]) {
      const { iso, local } = splitPhone(n);
      expect(joinPhone(iso, local)).toBe(n);
    }
  });
});
