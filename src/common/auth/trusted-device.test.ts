import { describe, expect, it } from "vitest";
import { isTrustedDevice, issueDeviceToken } from "./trusted-device";

const SECRET = "s".repeat(40);
const NOW = 1_800_000_000_000;

describe("trusted-device token", () => {
  it("is valid only for the email it was issued for, until it expires", () => {
    const token = issueDeviceToken("Jane@Example.com", NOW, SECRET)!;
    expect(isTrustedDevice(token, " jane@example.com ", NOW + 1000, SECRET)).toBe(true);
    expect(isTrustedDevice(token, "joe@example.com", NOW + 1000, SECRET)).toBe(false);
    expect(isTrustedDevice(token, "jane@example.com", NOW + 91 * 86_400_000, SECRET)).toBe(false);
  });

  it("rejects forged, tampered or oversized tokens, and is off without a secret", () => {
    const token = issueDeviceToken("jane@example.com", NOW, SECRET)!;
    const [exp, mac] = token.split(".");
    expect(isTrustedDevice(`${Number(exp) + 1}.${mac}`, "jane@example.com", NOW, SECRET)).toBe(false);
    expect(isTrustedDevice(token, "jane@example.com", NOW, "o".repeat(40))).toBe(false);
    expect(isTrustedDevice(`${token}.x`, "jane@example.com", NOW, SECRET)).toBe(false);
    expect(isTrustedDevice("9".repeat(300), "jane@example.com", NOW, SECRET)).toBe(false);
    expect(issueDeviceToken("jane@example.com", NOW, "")).toBeUndefined();
    expect(isTrustedDevice(token, "jane@example.com", NOW, "")).toBe(false);
  });
});
