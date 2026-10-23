import { describe, expect, it } from "vitest";
import { AppError } from "../../../common/errors/app-error";
import {
  assertContractDates,
  isCalendarDate,
  isSocialPlatform,
  isValidSocialHandle,
  normalizePhones,
  normalizeServices,
  normalizeSocialAccounts,
  normalizeWebsite,
  normalizeWebsites,
} from "./client-profile.rules";

describe("isValidSocialHandle", () => {
  it.each(["@acme", "acme", "acme.studio", "acme_official", "acme-co", "company/acme", "https://instagram.com/acme", "http://youtube.com/@acme"])(
    "accepts %s",
    (v) => expect(isValidSocialHandle(v)).toBe(true),
  );

  it.each(["", "acme studio", "javascript:alert(1)", "data:text/html,hi", "ftp://acme.com", "@", "acme/", "<script>", "x".repeat(201)])(
    "refuses %s",
    (v) => expect(isValidSocialHandle(v)).toBe(false),
  );
});

describe("isSocialPlatform", () => {
  it("knows the listed platforms only", () => {
    expect(isSocialPlatform("instagram")).toBe(true);
    expect(isSocialPlatform("x")).toBe(true);
    expect(isSocialPlatform("myspace")).toBe(false);
  });
});

describe("list normalisers", () => {
  it("keeps several accounts on one platform, dropping exact repeats", () => {
    expect(
      normalizeSocialAccounts([
        { platform: "instagram", handle: " @acme " },
        { platform: "instagram", handle: "@acme_shop" },
        { platform: "instagram", handle: "@ACME" },
        { platform: "tiktok", handle: "@acme" },
      ]),
    ).toEqual([
      { platform: "instagram", handle: "@acme" },
      { platform: "instagram", handle: "@acme_shop" },
      { platform: "tiktok", handle: "@acme" },
    ]);
  });

  it("normalises websites and drops repeats", () => {
    expect(normalizeWebsites(["acme.com", "https://acme.com", "shop.acme.com"])).toEqual(["https://acme.com", "https://shop.acme.com"]);
  });

  it("treats the same number with different spacing as one", () => {
    expect(normalizePhones([" +91 98200 11111", "+91-98200-11111", "+971 50 123 4567"])).toEqual(["+91 98200 11111", "+971 50 123 4567"]);
  });
});

describe("normalizeServices", () => {
  it("trims, drops blanks and case-insensitive duplicates, keeping the first spelling and the order", () => {
    expect(normalizeServices([" Reels ", "", "Shoots", "reels", "SEO"])).toEqual(["Reels", "Shoots", "SEO"]);
  });
});

describe("normalizeWebsite", () => {
  it("adds https:// to a bare domain", () => {
    expect(normalizeWebsite("acme.com")).toBe("https://acme.com");
    expect(normalizeWebsite(" www.acme.co.in/about ")).toBe("https://www.acme.co.in/about");
  });

  it("keeps an http(s) URL as typed", () => {
    expect(normalizeWebsite("http://acme.com")).toBe("http://acme.com");
  });

  it("refuses other schemes and hosts without a dot", () => {
    expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsite("ftp://acme.com")).toBeNull();
    expect(normalizeWebsite("localhost")).toBeNull();
    expect(normalizeWebsite("not a site")).toBeNull();
    expect(normalizeWebsite("")).toBeNull();
  });
});

describe("isCalendarDate", () => {
  it("accepts real YYYY-MM-DD days, including a leap day", () => {
    expect(isCalendarDate("2026-10-13")).toBe(true);
    expect(isCalendarDate("2028-02-29")).toBe(true);
  });

  it("refuses impossible days and other formats", () => {
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2027-02-29")).toBe(false);
    expect(isCalendarDate("13/10/2026")).toBe(false);
    expect(isCalendarDate("2026-10-13T00:00:00Z")).toBe(false);
  });
});

describe("assertContractDates", () => {
  it("allows a missing date on either side, and an end on or after the start", () => {
    expect(() => assertContractDates(null, null)).not.toThrow();
    expect(() => assertContractDates("2026-01-01", null)).not.toThrow();
    expect(() => assertContractDates(null, "2026-01-01")).not.toThrow();
    expect(() => assertContractDates("2026-01-01", "2026-01-01")).not.toThrow();
    expect(() => assertContractDates("2026-01-01", "2026-12-31")).not.toThrow();
  });

  it("refuses an end before the start with 400 CLIENT_CONTRACT_DATES_INVALID", () => {
    try {
      assertContractDates("2026-12-31", "2026-01-01");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(400);
      expect((err as AppError).code).toBe("CLIENT_CONTRACT_DATES_INVALID");
    }
  });
});
