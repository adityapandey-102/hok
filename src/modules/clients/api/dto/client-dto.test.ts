import { describe, expect, it } from "vitest";
import { createClientDtoSchema } from "./create-client.dto";
import { updateClientDtoSchema } from "./update-client.dto";
import { clientQueryDtoSchema } from "./client-query.dto";

/** Field validation at the edge (FR-CLI-02): what a create/update body may contain, and how it's normalised. */

const ok = (body: unknown) => createClientDtoSchema.safeParse(body);
const issuePaths = (body: unknown) => {
  const r = ok(body);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
};

describe("createClientDtoSchema", () => {
  it("needs only a business name, and trims it", () => {
    const r = ok({ businessName: "  Acme Bakery " });
    expect(r.success && r.data.businessName).toBe("Acme Bakery");
    expect(issuePaths({})).toContain("businessName");
    expect(issuePaths({ businessName: "   " })).toContain("businessName");
  });

  it("accepts a full profile and normalises it", () => {
    const r = ok({
      businessName: "Acme",
      logoUrl: "https://cdn.acme.com/logo.png",
      industry: "Food",
      contacts: [
        { name: " Priya ", phone: "+91 98765 43210", email: "Priya@Acme.com" },
        { name: "Dev", phone: "", email: null },
      ],
      phones: ["+91 98765 43210", "+91-98765-43210", "+44 20 7946 0958"],
      email: "Hello@Acme.COM",
      websites: ["acme.com", "https://shop.acme.com", "ACME.com"],
      socialAccounts: [
        { platform: "instagram", handle: " @acme " },
        { platform: "instagram", handle: "@acme_shop" },
        { platform: "instagram", handle: "@ACME" },
        { platform: "youtube", handle: "https://youtube.com/@acme" },
      ],
      services: ["Reels", "reels", " Shoots "],
      contractStart: "2026-01-01",
      contractEnd: "2026-12-31",
      timeZone: "Europe/London",
      notes: "VIP",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.email).toBe("hello@acme.com");
    // Several of each; exact duplicates (ignoring case / spacing) are kept once.
    expect(r.data.websites).toEqual(["https://acme.com", "https://shop.acme.com"]);
    expect(r.data.phones).toEqual(["+91 98765 43210", "+44 20 7946 0958"]);
    expect(r.data.contacts).toEqual([
      { name: "Priya", phone: "+91 98765 43210", email: "priya@acme.com" },
      { name: "Dev", phone: null, email: null },
    ]);
    expect(r.data.socialAccounts).toEqual([
      { platform: "instagram", handle: "@acme" },
      { platform: "instagram", handle: "@acme_shop" },
      { platform: "youtube", handle: "https://youtube.com/@acme" },
    ]);
    expect(r.data.services).toEqual(["Reels", "Shoots"]);
  });

  it("turns blank optional text into null", () => {
    const r = ok({ businessName: "Acme", industry: "", email: "" });
    expect(r.success && [r.data.industry, r.data.email]).toEqual([null, null]);
  });

  it("refuses a raw offset or unknown time zone", () => {
    expect(issuePaths({ businessName: "A", timeZone: "+05:30" })).toContain("timeZone");
    expect(issuePaths({ businessName: "A", timeZone: "Mars/Olympus" })).toContain("timeZone");
  });

  it("refuses unsafe or malformed links", () => {
    expect(issuePaths({ businessName: "A", logoUrl: "javascript:alert(1)" })).toContain("logoUrl");
    expect(issuePaths({ businessName: "A", logoUrl: "logo.png" })).toContain("logoUrl");
    expect(issuePaths({ businessName: "A", websites: ["javascript:alert(1)"] })).toContain("websites.0");
    expect(issuePaths({ businessName: "A", websites: ["acme.com", "not a site"] })).toContain("websites.1");
  });

  it("refuses an unknown platform, a bad or empty handle, and a contact with no name", () => {
    expect(issuePaths({ businessName: "A", socialAccounts: [{ platform: "myspace", handle: "@a" }] })).toContain("socialAccounts.0.platform");
    expect(issuePaths({ businessName: "A", socialAccounts: [{ platform: "instagram", handle: "acme bakery" }] })).toContain("socialAccounts.0.handle");
    expect(issuePaths({ businessName: "A", socialAccounts: [{ platform: "instagram", handle: "javascript:alert(1)" }] })).toContain("socialAccounts.0.handle");
    expect(issuePaths({ businessName: "A", socialAccounts: [{ platform: "instagram", handle: " " }] })).toContain("socialAccounts.0.handle");
    expect(issuePaths({ businessName: "A", contacts: [{ name: " ", phone: null, email: null }] })).toContain("contacts.0.name");
    expect(issuePaths({ businessName: "A", contacts: [{ name: "Priya", phone: "call me", email: "nope" }] })).toEqual(
      expect.arrayContaining(["contacts.0.phone", "contacts.0.email"]),
    );
  });

  it("caps each list", () => {
    expect(issuePaths({ businessName: "A", websites: Array.from({ length: 11 }, (_, i) => `s${i}.example.com`) })).toContain("websites");
    expect(issuePaths({ businessName: "A", phones: Array.from({ length: 11 }, (_, i) => `+91 98200 0000${i}`) })).toContain("phones");
    expect(issuePaths({ businessName: "A", contacts: Array.from({ length: 21 }, (_, i) => ({ name: `P${i}` })) })).toContain("contacts");
  });

  it("refuses a bad email, phone, impossible date, and too many services", () => {
    expect(issuePaths({ businessName: "A", email: "nope" })).toContain("email");
    expect(issuePaths({ businessName: "A", phones: ["call me"] })).toContain("phones.0");
    expect(issuePaths({ businessName: "A", contractStart: "2026-02-30" })).toContain("contractStart");
    expect(issuePaths({ businessName: "A", services: Array.from({ length: 21 }, (_, i) => `S${i}`) })).toContain("services");
  });

  it("accepts an optional ownerId only as a uuid", () => {
    expect(ok({ businessName: "A", ownerId: "7c443f82-7913-4383-b49c-605bdbe8e139" }).success).toBe(true);
    expect(issuePaths({ businessName: "A", ownerId: "rohan" })).toContain("ownerId");
  });
});

describe("updateClientDtoSchema", () => {
  it("requires a version and allows a partial edit", () => {
    expect(updateClientDtoSchema.safeParse({ notes: "x" }).success).toBe(false);
    const r = updateClientDtoSchema.safeParse({ notes: "x", version: 2 });
    expect(r.success && r.data).toMatchObject({ notes: "x", version: 2 });
  });

  it("lets status move between active and paused only (archiving has its own endpoint)", () => {
    expect(updateClientDtoSchema.safeParse({ status: "paused", version: 1 }).success).toBe(true);
    expect(updateClientDtoSchema.safeParse({ status: "archived", version: 1 }).success).toBe(false);
  });

  it("null clears an optional field, [] clears a list; businessName can't be cleared", () => {
    const r = updateClientDtoSchema.safeParse({ email: null, phones: [], version: 1 });
    expect(r.success && [r.data.email, r.data.phones]).toEqual([null, []]);
    expect(updateClientDtoSchema.safeParse({ businessName: "", version: 1 }).success).toBe(false);
  });

  it("ignores ownerId and other unknown keys (ownership changes only through reassign)", () => {
    const r = updateClientDtoSchema.safeParse({ ownerId: "x", notes: "y", version: 1 });
    expect(r.success && "ownerId" in r.data).toBe(false);
  });
});

describe("clientQueryDtoSchema", () => {
  it("defaults and clamps the page", () => {
    expect(clientQueryDtoSchema.parse({})).toMatchObject({ limit: 20, offset: 0 });
    expect(clientQueryDtoSchema.parse({ limit: "100000" }).limit).toBe(100);
    expect(clientQueryDtoSchema.parse({ limit: "0" }).limit).toBe(1);
  });

  it("refuses an unknown status, a malformed ownerId and a non-numeric limit", () => {
    expect(clientQueryDtoSchema.safeParse({ status: "deleted" }).success).toBe(false);
    expect(clientQueryDtoSchema.safeParse({ ownerId: "rohan" }).success).toBe(false);
    expect(clientQueryDtoSchema.safeParse({ limit: "abc" }).success).toBe(false);
  });

  it("treats a blank search or industry as no filter", () => {
    expect(clientQueryDtoSchema.parse({ search: "  ", industry: "" })).toMatchObject({ search: undefined, industry: undefined });
  });
});
