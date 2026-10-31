import { describe, expect, it } from "vitest";
import { pickOwnProfileChanges, type OwnProfileChanges } from "./own-profile.rules";

describe("pickOwnProfileChanges", () => {
  it("keeps only the fields that were sent", () => {
    expect(pickOwnProfileChanges({ timeZone: "Europe/London" })).toEqual({ timeZone: "Europe/London" });
  });

  it("treats null as 'clear this field', not as 'absent'", () => {
    expect(pickOwnProfileChanges({ phone: null, avatarUrl: null })).toEqual({ phone: null, avatarUrl: null });
  });

  it("drops anything that is not a self-editable field (role, email, active)", () => {
    const sneaky = { fullName: "Ana", role: "admin", active: false } as unknown as OwnProfileChanges;
    expect(pickOwnProfileChanges(sneaky)).toEqual({ fullName: "Ana" });
  });

  it("refuses an empty edit with VALIDATION_NO_FIELDS", () => {
    expect(() => pickOwnProfileChanges({})).toThrow(expect.objectContaining({ code: "VALIDATION_NO_FIELDS" }) as Error);
  });
});
