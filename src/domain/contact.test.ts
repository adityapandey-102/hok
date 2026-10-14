import { describe, expect, it } from "vitest";
import { isValidHttpUrl, isValidPhone } from "./contact";

describe("isValidPhone", () => {
  it("accepts common international and local formats", () => {
    for (const phone of ["+91 98765 43210", "9876543210", "(020) 7946-0958", "+44 20 7946 0958", "+971-4-123-4567"]) {
      expect(isValidPhone(phone)).toBe(true);
    }
  });

  it("rejects letters, too few or too many digits, a misplaced + and over-long input", () => {
    for (const phone of ["", "call me", "12345", "+1234567890123456", "98+76543210", "1".repeat(25), "98765 43210 ext 5"]) {
      expect(isValidPhone(phone)).toBe(false);
    }
  });
});

describe("isValidHttpUrl", () => {
  it("accepts absolute http and https links", () => {
    expect(isValidHttpUrl("https://drive.google.com/file/d/abc/view")).toBe(true);
    expect(isValidHttpUrl("http://example.com/photo.jpg")).toBe(true);
  });

  it("rejects relative paths, script and data URLs, other schemes and over-long values", () => {
    for (const value of ["", "/photo.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "ftp://example.com/x", `https://example.com/${"a".repeat(2048)}`]) {
      expect(isValidHttpUrl(value)).toBe(false);
    }
  });
});
