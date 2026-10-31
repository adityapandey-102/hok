import { describe, expect, it } from "vitest";
import { loginEmailKey } from "./rate-limit.middleware";

describe("loginEmailKey", () => {
  it("keys on the lower-cased, trimmed email regardless of IP", () => {
    const a = loginEmailKey({ body: { email: "  Jane@Example.COM " }, ip: "203.0.113.7" });
    expect(a).toBe(loginEmailKey({ body: { email: "jane@example.com" }, ip: "198.51.100.1" }));
    expect(a).not.toBe(loginEmailKey({ body: { email: "joe@example.com" }, ip: "203.0.113.7" }));
  });

  it("falls back to the IP key when the email is missing or not a string", () => {
    expect(loginEmailKey({ body: {}, ip: "203.0.113.7" })).toBe("203.0.113.7");
    expect(loginEmailKey({ body: undefined, ip: "203.0.113.7" })).toBe("203.0.113.7");
    expect(loginEmailKey({ body: { email: 5 }, ip: "203.0.113.7" })).toBe("203.0.113.7");
    expect(loginEmailKey({ body: { email: "  " }, ip: "203.0.113.7" })).toBe("203.0.113.7");
  });
});
