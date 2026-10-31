import { describe, expect, it } from "vitest";
import { inviteUserSchema, updateOwnProfileSchema, updateUserSchema } from "./user";

describe("inviteUserSchema", () => {
  it("accepts a valid invite", () => {
    expect(inviteUserSchema.safeParse({ email: "a@b.com", fullName: "A B", role: "editor" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(inviteUserSchema.safeParse({ email: "not-an-email", fullName: "A B", role: "editor" }).success).toBe(false);
  });

  it("rejects an unknown role", () => {
    expect(inviteUserSchema.safeParse({ email: "a@b.com", fullName: "A B", role: "superadmin" }).success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a partial update of just `active`", () => {
    expect(updateUserSchema.safeParse({ active: false }).success).toBe(true);
  });
});

describe("updateOwnProfileSchema", () => {
  it("accepts a named zone and an empty phone", () => {
    expect(updateOwnProfileSchema.safeParse({ fullName: "A B", phone: "", timeZone: "Asia/Kolkata" }).success).toBe(true);
  });

  it("rejects a raw offset time zone and an empty name", () => {
    expect(updateOwnProfileSchema.safeParse({ fullName: "A B", phone: "", timeZone: "+05:30" }).success).toBe(false);
    expect(updateOwnProfileSchema.safeParse({ fullName: " ", phone: "", timeZone: "Asia/Kolkata" }).success).toBe(false);
  });
});
